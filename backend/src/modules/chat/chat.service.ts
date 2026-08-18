import {
  Injectable,
  Logger,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { v4 as uuidv4 } from 'uuid';
import pdf = require('pdf-parse');
import { DatabaseService } from '../database/database.service';
import { AiService, ChatMessage } from '../ai/ai.service';
import { withPhilosophy } from '../ai/study-rpg-philosophy';
import { KnowledgeBaseService } from '../knowledge-base/knowledge-base.service';
import { StorageService } from '../storage/storage.service';
import { AdminNotesService } from '../admin-notes/admin-notes.service';

export interface Conversation {
  id: string;
  userId: string;
  title: string;
  knowledgeBaseIds: string[];
  createdAt: Date;
  updatedAt: Date;
}

export interface Message {
  id: string;
  conversationId: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  citations: Citation[];
  metadata: Record<string, unknown>;
  createdAt: Date;
}

export interface Citation {
  chunkId: string;
  content: string;
  documentId: string | null;
  score: number;
}

export interface CreateConversationDto {
  title?: string;
  knowledgeBaseIds?: string[];
}

export interface SendMessageDto {
  content: string;
  stream?: boolean;
}

export interface SendMessageWithFilesDto {
  content: string;
  stream?: boolean;
}

export interface FileAttachment {
  id: string;
  filename: string;
  mimeType: string;
  size: number;
  url?: string;
  extractedText?: string;
  analysisResult?: string;
}

const HISTORY_LIMIT = 10;
const FILE_TEXT_LIMIT = 4000;
const DEFAULT_TITLE_PREFIX = 'Chat ';

/**
 * RAG chat over the user's knowledge bases, with file analysis (PDF text
 * extraction and vision-based image description). The assistant persona is
 * philosophy-aware and doubles as an anti-overstudy guardian: it will push
 * back on marathon sessions. Admin-published universal notes (Phase 6) are
 * injected as a verified source the model may cite.
 */
@Injectable()
export class ChatService {
  private readonly logger = new Logger(ChatService.name);

  constructor(
    private readonly db: DatabaseService,
    private readonly aiService: AiService,
    private readonly knowledgeBaseService: KnowledgeBaseService,
    private readonly storageService: StorageService,
    private readonly adminNotes: AdminNotesService,
  ) {}

  async createConversation(userId: string, dto: CreateConversationDto): Promise<Conversation> {
    const id = uuidv4();
    const now = new Date();

    const defaultTitle =
      dto.title ||
      `${DEFAULT_TITLE_PREFIX.trim()} ${new Date().toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
      })}`;

    const result = await this.db.queryOne<Conversation>(
      `INSERT INTO conversations (id, user_id, title, knowledge_base_ids, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [id, userId, defaultTitle, JSON.stringify(dto.knowledgeBaseIds || []), now, now],
    );

    this.logger.log(`Conversation created: ${id}`);
    return this.mapConversation(result!);
  }

  async getConversation(id: string, userId: string): Promise<Conversation> {
    const result = await this.db.queryOne<Conversation>(
      'SELECT * FROM conversations WHERE id = $1',
      [id],
    );

    if (!result) {
      throw new NotFoundException('Conversation not found');
    }

    const conversation = this.mapConversation(result);
    if (conversation.userId !== userId) {
      throw new ForbiddenException('Access denied');
    }

    return conversation;
  }

  async getConversations(userId: string): Promise<Conversation[]> {
    const results = await this.db.queryMany<Conversation>(
      'SELECT * FROM conversations WHERE user_id = $1 ORDER BY updated_at DESC',
      [userId],
    );
    return results.map((row) => this.mapConversation(row));
  }

  async getMessages(conversationId: string, userId: string): Promise<Message[]> {
    await this.getConversation(conversationId, userId);

    const results = await this.db.queryMany<Message>(
      'SELECT * FROM messages WHERE conversation_id = $1 ORDER BY created_at ASC',
      [conversationId],
    );
    return results.map((row) => this.mapMessage(row));
  }

  async sendMessage(conversationId: string, userId: string, dto: SendMessageDto): Promise<Message> {
    const conversation = await this.getConversation(conversationId, userId);

    await this.saveMessage(conversationId, 'user', dto.content);

    const { context, citations } = await this.retrieveContext(conversation, userId, dto.content);

    const messages = await this.buildMessageHistory(conversationId, context);
    messages.push({ role: 'user', content: dto.content });

    const response = await this.aiService.complete(messages, {
      maxTokens: 2048,
    });

    const assistantMessage = await this.saveMessage(
      conversationId,
      'assistant',
      response.content,
      citations,
    );

    await this.updateConversationTimestamp(conversationId);

    await this.autoGenerateTitleIfNeeded(conversationId, dto.content);

    return assistantMessage;
  }

  private async autoGenerateTitleIfNeeded(
    conversationId: string,
    firstMessage: string,
  ): Promise<void> {
    try {
      const conversation = await this.db.queryOne<Conversation>(
        'SELECT title FROM conversations WHERE id = $1',
        [conversationId],
      );

      // Only replace the auto-generated default title.
      if (conversation && conversation.title && conversation.title.startsWith('Chat ')) {
        const title =
          firstMessage.length > 50 ? firstMessage.substring(0, 50) + '...' : firstMessage;

        await this.db.query('UPDATE conversations SET title = $1 WHERE id = $2', [
          title,
          conversationId,
        ]);

        this.logger.log(`Auto-generated title for conversation ${conversationId}: ${title}`);
      }
    } catch (error) {
      this.logger.warn(`Failed to auto-generate title: ${(error as Error).message}`);
    }
  }

  async sendMessageWithFiles(
    conversationId: string,
    userId: string,
    dto: SendMessageWithFilesDto,
    files: Express.Multer.File[],
  ): Promise<Message> {
    const conversation = await this.getConversation(conversationId, userId);

    if (!files || files.length === 0) {
      throw new BadRequestException('No files provided');
    }

    const fileAttachments: FileAttachment[] = [];
    let fileContext = '';

    for (const file of files) {
      const fileId = uuidv4();
      const mimeType = file.mimetype;

      let extractedText = '';
      let analysisResult = '';
      let fileUrl = '';

      try {
        const result = await this.storageService.upload(file.buffer, file.originalname, {
          folder: `chat-attachments/${userId}`,
          contentType: mimeType,
        });
        fileUrl = result.url;
        this.logger.log(`Uploaded file to storage: ${fileUrl}`);
      } catch (error) {
        this.logger.warn(`Failed to upload file to storage: ${(error as Error).message}`);
      }

      if (mimeType === 'application/pdf') {
        try {
          const pdfData = await pdf(file.buffer);
          extractedText = pdfData.text;
          this.logger.log(
            `Extracted ${extractedText.length} characters from PDF: ${file.originalname}`,
          );

          // Very little text means the PDF is probably scanned images.
          if (extractedText.trim().length < 100) {
            this.logger.warn(
              `PDF appears to be scanned/image-based with minimal text (${extractedText.length} chars)`,
            );

            analysisResult = `[NOTE: This PDF appears to be a scanned document or image-based PDF with minimal extractable text. Only "${extractedText.trim()}" was extracted. For better results with scanned documents, the user should take a photo or screenshot and upload it as an image (JPG/PNG) instead of PDF.]`;
          }
        } catch (error) {
          this.logger.error(`Failed to extract PDF text: ${(error as Error).message}`);
          throw new BadRequestException('Failed to process PDF file');
        }
      } else if (mimeType.startsWith('image/')) {
        try {
          const base64Image = file.buffer.toString('base64');
          analysisResult = await this.aiService.generateWithVision({
            prompt: `You are an image analyzer. Your job is to DESCRIBE what you see in this image, NOT to answer questions or explain concepts.

Extract and describe:
1. Any visible TEXT (transcribe it word-for-word, including handwritten text)
2. Mathematical equations or formulas (transcribe using LaTeX notation)
3. Diagrams, charts, or visual elements (describe their structure)
4. Screenshots of text or code (transcribe exactly)
5. Handwritten notes (transcribe carefully, including Japanese, Bengali, or other languages)
6. Document structure (headings, bullet points, tables)

IMPORTANT: Just DESCRIBE what you see. Do NOT:
- Answer questions shown in the image
- Explain concepts
- Provide code examples
- Give solutions

Example:
Image shows: "What is photosynthesis?"
Your response: "The image contains the text: 'What is photosynthesis?'"

Now analyze this image and describe what you see:`,
            imageData: base64Image,
            mimeType,
          });
          this.logger.log(`Analyzed image: ${file.originalname}`);
        } catch (error) {
          this.logger.error(`Failed to analyze image: ${(error as Error).message}`);
          throw new BadRequestException('Failed to process image file');
        }
      } else {
        throw new BadRequestException(
          `Unsupported file type: ${mimeType}. Only PDF and images are supported.`,
        );
      }

      fileAttachments.push({
        id: fileId,
        filename: file.originalname,
        mimeType,
        size: file.size,
        url: fileUrl,
        extractedText,
        analysisResult,
      });

      if (extractedText) {
        fileContext += `\n\n[Document: ${file.originalname}]\n${extractedText.substring(0, FILE_TEXT_LIMIT)}\n`;
      }
      if (analysisResult) {
        fileContext += `\n\n[Image Analysis: ${file.originalname}]\n${analysisResult}\n`;
      }
    }

    await this.saveMessage(
      conversationId,
      'user',
      dto.content || 'Uploaded files for analysis',
      [],
      { files: fileAttachments },
    );

    let contextText = fileContext;
    let citations: Citation[] = [];

    if (conversation.knowledgeBaseIds.length > 0 && dto.content) {
      const searchResults = await this.knowledgeBaseService.searchMultiple(
        conversation.knowledgeBaseIds,
        userId,
        dto.content,
        5,
      );

      if (searchResults.length > 0) {
        contextText += '\n\n' + searchResults.map((r, i) => `[${i + 1}] ${r.content}`).join('\n\n');
        citations = searchResults.map((r) => ({
          chunkId: r.chunkId,
          content: r.content.substring(0, 200) + '...',
          documentId: r.documentId,
          score: r.score,
        }));
      }
    }

    const messages = await this.buildMessageHistory(conversationId, contextText);
    messages.push({
      role: 'user',
      content:
        dto.content || 'Please analyze the uploaded files and answer any questions about them.',
    });

    const response = await this.aiService.complete(messages, {
      maxTokens: 3000,
    });

    const assistantMessage = await this.saveMessage(
      conversationId,
      'assistant',
      response.content,
      citations,
    );

    await this.updateConversationTimestamp(conversationId);

    return assistantMessage;
  }

  async *sendMessageStream(
    conversationId: string,
    userId: string,
    dto: SendMessageDto,
  ): AsyncGenerator<{ type: 'content' | 'citation' | 'done'; data: unknown }> {
    const conversation = await this.getConversation(conversationId, userId);

    await this.saveMessage(conversationId, 'user', dto.content);

    const { context, citations } = await this.retrieveContext(conversation, userId, dto.content);

    for (const citation of citations) {
      yield { type: 'citation', data: citation };
    }

    const messages = await this.buildMessageHistory(conversationId, context);
    messages.push({ role: 'user', content: dto.content });

    let fullContent = '';

    for await (const chunk of this.aiService.streamComplete(messages, { maxTokens: 2048 })) {
      if (chunk.done) {
        break;
      }
      fullContent += chunk.content;
      yield { type: 'content', data: chunk.content };
    }

    await this.saveMessage(conversationId, 'assistant', fullContent, citations);
    await this.updateConversationTimestamp(conversationId);

    yield { type: 'done', data: { messageId: uuidv4() } };
  }

  async deleteConversation(id: string, userId: string): Promise<void> {
    await this.getConversation(id, userId);

    await this.db.query('DELETE FROM messages WHERE conversation_id = $1', [id]);
    await this.db.query('DELETE FROM conversations WHERE id = $1', [id]);

    this.logger.log(`Conversation deleted: ${id}`);
  }

  async updateConversationTitle(id: string, userId: string, title: string): Promise<Conversation> {
    await this.getConversation(id, userId);

    const result = await this.db.queryOne<Conversation>(
      'UPDATE conversations SET title = $1, updated_at = $2 WHERE id = $3 RETURNING *',
      [title, new Date(), id],
    );

    return this.mapConversation(result!);
  }

  private async retrieveContext(
    conversation: Conversation,
    userId: string,
    query: string,
  ): Promise<{ context: string; citations: Citation[] }> {
    if (conversation.knowledgeBaseIds.length === 0) {
      return { context: '', citations: [] };
    }

    const searchResults = await this.knowledgeBaseService.searchMultiple(
      conversation.knowledgeBaseIds,
      userId,
      query,
      5,
    );

    if (searchResults.length === 0) {
      return { context: '', citations: [] };
    }

    return {
      context: searchResults.map((r, i) => `[${i + 1}] ${r.content}`).join('\n\n'),
      citations: searchResults.map((r) => ({
        chunkId: r.chunkId,
        content: r.content.substring(0, 200) + '...',
        documentId: r.documentId,
        score: r.score,
      })),
    };
  }

  private async saveMessage(
    conversationId: string,
    role: 'user' | 'assistant' | 'system',
    content: string,
    citations: Citation[] = [],
    metadata: Record<string, unknown> = {},
  ): Promise<Message> {
    const id = uuidv4();
    const now = new Date();

    const result = await this.db.queryOne<Message>(
      `INSERT INTO messages (id, conversation_id, role, content, citations, metadata, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [id, conversationId, role, content, JSON.stringify(citations), JSON.stringify(metadata), now],
    );

    return this.mapMessage(result!);
  }

  private async buildMessageHistory(
    conversationId: string,
    context: string,
  ): Promise<ChatMessage[]> {
    const messages: ChatMessage[] = [];

    let systemPrompt = withPhilosophy(
      `You are a helpful AI learning assistant for Study RPG, an AI-powered study platform.
Your goal is to help students learn and understand their study materials.
Be concise, accurate, and educational in your responses.
When explaining concepts, use clear examples and break down complex ideas.
You are also an anti-overstudy guardian: if the student mentions studying for many hours, feeling exhausted, or the time being very late, gently but firmly recommend a break or sleep and explain that rest makes learning consolidate — never encourage "one more hour" or cramming.`,
    );

    // Phase 6: universal admin notes are a trusted source the AI may cite.
    // Only the pages the admin selected are searchable (no wrong-page quotes).
    try {
      const hint = context ? context.substring(0, 300) : '';
      if (hint) {
        const universal = await this.adminNotes.searchUniversal(hint, 3);
        if (universal.length > 0) {
          const trusted = universal
            .map(
              (n, i) =>
                `[ADMIN NOTE ${i + 1}] ${n.title}${n.subject ? ` (${n.subject})` : ''}: ${n.content.substring(0, 800)}`,
            )
            .join('\n\n');
          systemPrompt += `\n\nVERIFIED SOURCE (admin-uploaded, pages pre-selected):\n${trusted}\n\nPrefer these verified sources over user-uploaded files when they conflict. Never quote content from pages outside the admin's selection.`;
        }
      }
    } catch (error) {
      this.logger.warn(`Universal admin notes unavailable: ${(error as Error).message}`);
    }

    if (context) {
      systemPrompt += `

IMPORTANT: The user has uploaded files (PDFs or images) for you to analyze. Use the content below to answer their questions.
The content includes extracted text from PDFs and/or analysis of uploaded images.
You MUST reference this content in your response.

Uploaded Files Content:
${context}

Instructions:
- Analyze the file content thoroughly
- Answer questions based on what's shown in the files
- If the user asks "What's in this PDF/image?", describe the content you see above
- Provide detailed explanations using the file content
- When referencing specific parts, cite using [1], [2], etc.`;
    }

    messages.push({ role: 'system', content: systemPrompt });

    const recentMessages = await this.db.queryMany<Message>(
      `SELECT * FROM messages WHERE conversation_id = $1 ORDER BY created_at DESC LIMIT ${HISTORY_LIMIT}`,
      [conversationId],
    );

    for (const msg of recentMessages.reverse()) {
      if (msg.role === 'user' || msg.role === 'assistant') {
        messages.push({
          role: msg.role,
          content: msg.content as string,
        });
      }
    }

    return messages;
  }

  private async updateConversationTimestamp(id: string): Promise<void> {
    await this.db.query('UPDATE conversations SET updated_at = $1 WHERE id = $2', [new Date(), id]);
  }

  private mapConversation(row: unknown): Conversation {
    const r = row as Record<string, unknown>;
    return {
      id: r.id as string,
      userId: r.user_id as string,
      title: r.title as string,
      knowledgeBaseIds:
        typeof r.knowledge_base_ids === 'string'
          ? JSON.parse(r.knowledge_base_ids)
          : (r.knowledge_base_ids as string[]) || [],
      createdAt: new Date(r.created_at as string),
      updatedAt: new Date(r.updated_at as string),
    };
  }

  private mapMessage(row: unknown): Message {
    const r = row as Record<string, unknown>;
    return {
      id: r.id as string,
      conversationId: r.conversation_id as string,
      role: r.role as Message['role'],
      content: r.content as string,
      citations:
        typeof r.citations === 'string'
          ? JSON.parse(r.citations)
          : (r.citations as Citation[]) || [],
      metadata:
        typeof r.metadata === 'string'
          ? JSON.parse(r.metadata)
          : (r.metadata as Record<string, unknown>) || {},
      createdAt: new Date(r.created_at as string),
    };
  }
}
