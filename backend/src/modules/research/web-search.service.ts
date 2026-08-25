import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export interface SearchResult {
  title: string;
  url: string;
  snippet: string;
  source: string;
}

/**
 * Thin facade over the configured web-search providers. Selection
 * (`SEARCH_PROVIDER`, owner policy T4 — fully local by default):
 *   - `searxng` — DEFAULT: the local SearXNG meta-search container (compose),
 *     no API key, no account. Deep Research works offline.
 *   - `tavily` / `serper` — opt-in commercial providers for hosted installs.
 */
@Injectable()
export class WebSearchService {
  private readonly logger = new Logger(WebSearchService.name);
  private readonly tavilyApiKey: string;
  private readonly serperApiKey: string;
  private readonly searxngBaseUrl: string;
  private readonly provider: 'searxng' | 'tavily' | 'serper';

  constructor(private readonly configService: ConfigService) {
    this.tavilyApiKey = this.configService.get<string>('TAVILY_API_KEY', '');
    this.serperApiKey = this.configService.get<string>('SERPER_API_KEY', '');
    this.searxngBaseUrl = (
      this.configService.get<string>('SEARXNG_BASE_URL') || 'http://localhost:8888'
    ).replace(/\/$/, '');

    const configured = (
      this.configService.get<string>('SEARCH_PROVIDER') || (this.searxngBaseUrl ? 'searxng' : '')
    ).toLowerCase();
    if (configured === 'tavily' && this.tavilyApiKey) {
      this.provider = 'tavily';
    } else if (configured === 'serper' && this.serperApiKey) {
      this.provider = 'serper';
    } else if (configured === 'searxng') {
      this.provider = 'searxng';
    } else if (this.tavilyApiKey) {
      this.provider = 'tavily';
    } else if (this.serperApiKey) {
      this.provider = 'serper';
    } else {
      // Local-first default; works whenever the compose stack is up.
      this.provider = 'searxng';
    }
  }

  getProvider(): string {
    return this.provider;
  }

  async search(query: string, maxResults = 5): Promise<SearchResult[]> {
    if (this.provider === 'tavily') {
      return this.searchWithTavily(query, maxResults);
    }
    if (this.provider === 'serper') {
      return this.searchWithSerper(query, maxResults);
    }
    return this.searchWithSearxng(query, maxResults);
  }

  /** Local SearXNG meta-search (JSON API). No key, no external account. */
  private async searchWithSearxng(query: string, maxResults: number): Promise<SearchResult[]> {
    try {
      const params = new URLSearchParams({
        q: query,
        format: 'json',
        language: 'en',
      });
      const response = await fetch(`${this.searxngBaseUrl}/search?${params.toString()}`, {
        signal: AbortSignal.timeout(15_000),
      });
      if (!response.ok) throw new Error(`SearXNG error: ${response.status}`);

      const data = await response.json();
      return (data.results || [])
        .slice(0, maxResults)
        .map((r: { title: string; url: string; content?: string; engine?: string }) => ({
          title: r.title,
          url: r.url,
          snippet: r.content || '',
          source: r.engine || 'searxng',
        }));
    } catch (error) {
      this.logger.warn(
        `SearXNG search failed at ${this.searxngBaseUrl} (is the searxng container running?)`,
        error,
      );
      return [];
    }
  }

  private async searchWithTavily(query: string, maxResults: number): Promise<SearchResult[]> {
    try {
      const response = await fetch('https://api.tavily.com/search', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          api_key: this.tavilyApiKey,
          query,
          search_depth: 'advanced',
          max_results: maxResults,
          include_answer: false,
        }),
      });

      if (!response.ok) throw new Error(`Tavily error: ${response.status}`);

      const data = await response.json();
      return (data.results || []).map((r: { title: string; url: string; content: string }) => ({
        title: r.title,
        url: r.url,
        snippet: r.content,
        source: 'tavily',
      }));
    } catch (error) {
      this.logger.error('Tavily search failed', error);
      return [];
    }
  }

  private async searchWithSerper(query: string, maxResults: number): Promise<SearchResult[]> {
    try {
      const response = await fetch('https://google.serper.dev/search', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-API-KEY': this.serperApiKey,
        },
        body: JSON.stringify({ q: query, num: maxResults }),
      });

      if (!response.ok) throw new Error(`Serper error: ${response.status}`);

      const data = await response.json();
      return (data.organic || []).map((r: { title: string; link: string; snippet: string }) => ({
        title: r.title,
        url: r.link,
        snippet: r.snippet,
        source: 'serper',
      }));
    } catch (error) {
      this.logger.error('Serper search failed', error);
      return [];
    }
  }
}
