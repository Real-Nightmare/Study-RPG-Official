import api from './api';
import { ENDPOINTS } from '@/config/api';
import type {
  AcademicStructure,
  AcademicProfile,
  UpdateAcademicProfileRequest,
  Subject,
  CreateSubjectRequest,
  UpdateSubjectRequest,
  Chapter,
  CreateChapterRequest,
  Topic,
  CreateTopicRequest,
  Exam,
  CreateExamRequest,
  ExamPortion,
  AddPortionRequest,
} from '@/types';

export const academicsService = {
  // Structure & profile
  async structure(): Promise<AcademicStructure> {
    const response = await api.get<AcademicStructure>(ENDPOINTS.academics.structure);
    return response.data;
  },

  async profile(): Promise<AcademicProfile | null> {
    const response = await api.get<AcademicProfile | null>(ENDPOINTS.academics.profile);
    return response.data;
  },

  async updateProfile(data: UpdateAcademicProfileRequest): Promise<AcademicProfile | null> {
    const response = await api.put<AcademicProfile | null>(ENDPOINTS.academics.profile, data);
    return response.data;
  },

  // Subjects
  async createSubject(data: CreateSubjectRequest): Promise<Subject> {
    const response = await api.post<Subject>(ENDPOINTS.academics.subjects, data);
    return response.data;
  },

  async updateSubject(id: string, data: UpdateSubjectRequest): Promise<Subject> {
    const response = await api.put<Subject>(ENDPOINTS.academics.subject(id), data);
    return response.data;
  },

  async deleteSubject(id: string): Promise<void> {
    await api.delete(ENDPOINTS.academics.subject(id));
  },

  // Chapters
  async createChapter(subjectId: string, data: CreateChapterRequest): Promise<Chapter> {
    const response = await api.post<Chapter>(ENDPOINTS.academics.chapters(subjectId), data);
    return response.data;
  },

  async deleteChapter(id: string): Promise<void> {
    await api.delete(ENDPOINTS.academics.chapter(id));
  },

  // Topics
  async createTopic(chapterId: string, data: CreateTopicRequest): Promise<Topic> {
    const response = await api.post<Topic>(ENDPOINTS.academics.topics(chapterId), data);
    return response.data;
  },

  async deleteTopic(id: string): Promise<void> {
    await api.delete(ENDPOINTS.academics.topic(id));
  },

  // Exams
  async listExams(): Promise<Exam[]> {
    const response = await api.get<Exam[]>(ENDPOINTS.academics.exams);
    return response.data;
  },

  async createExam(data: CreateExamRequest): Promise<Exam> {
    const response = await api.post<Exam>(ENDPOINTS.academics.exams, data);
    return response.data;
  },

  async deleteExam(id: string): Promise<void> {
    await api.delete(ENDPOINTS.academics.exam(id));
  },

  // Portions
  async addPortion(examId: string, data: AddPortionRequest): Promise<ExamPortion> {
    const response = await api.post<ExamPortion>(ENDPOINTS.academics.portions(examId), data);
    return response.data;
  },

  async removePortion(examId: string, portionId: string): Promise<void> {
    await api.delete(ENDPOINTS.academics.portion(examId, portionId));
  },
};
