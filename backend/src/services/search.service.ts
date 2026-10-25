import { Client } from '@elastic/elasticsearch';
import { config } from '../config/env';
import { prisma } from '../db/prisma';

class SearchService {
  private client: Client;
  private isConnected = false;

  constructor() {
    this.client = new Client({
      node: config.elasticsearch.node,
      requestTimeout: 2000,
    });
    this.init();
  }

  private async init() {
    try {
      await this.client.ping();
      this.isConnected = true;
      console.log('[Elasticsearch] Connected to Elasticsearch node at', config.elasticsearch.node);

      // Ensure index exists
      const exists = await this.client.indices.exists({ index: config.elasticsearch.index });
      if (!exists) {
        await this.client.indices.create({
          index: config.elasticsearch.index,
          mappings: {
            properties: {
              id: { type: 'keyword' },
              jobId: { type: 'keyword' },
              sender: { type: 'keyword' },
              recipient: { type: 'text', fields: { keyword: { type: 'keyword' } } },
              subject: { type: 'text' },
              body: { type: 'text' },
              status: { type: 'keyword' },
              scheduledFor: { type: 'date' },
              sentAt: { type: 'date' },
              createdAt: { type: 'date' },
            },
          },
        });
        console.log(`[Elasticsearch] Index '${config.elasticsearch.index}' created successfully.`);
      }
    } catch (err: any) {
      this.isConnected = false;
      console.log('[Elasticsearch] Node unreachable, using Prisma database search fallback. (Elasticsearch is active when docker container runs)');
    }
  }

  public async indexEmail(email: {
    id: string;
    jobId: string;
    sender: string;
    recipient: string;
    subject: string;
    body: string;
    status: string;
    scheduledFor: Date;
    sentAt?: Date | null;
    createdAt?: Date;
  }): Promise<void> {
    if (!this.isConnected) return;
    try {
      await this.client.index({
        index: config.elasticsearch.index,
        id: email.id,
        document: {
          id: email.id,
          jobId: email.jobId,
          sender: email.sender,
          recipient: email.recipient,
          subject: email.subject,
          body: email.body,
          status: email.status,
          scheduledFor: email.scheduledFor.toISOString(),
          sentAt: email.sentAt ? email.sentAt.toISOString() : null,
          createdAt: email.createdAt ? email.createdAt.toISOString() : new Date().toISOString(),
        },
      });
    } catch (err: any) {
      console.warn('[Elasticsearch] Failed to index email doc:', err.message);
    }
  }

  public async searchEmails(query: string, status?: string): Promise<any[]> {
    if (this.isConnected && query.trim()) {
      try {
        const mustClauses: any[] = [
          {
            multi_match: {
              query,
              fields: ['subject^3', 'recipient^2', 'body', 'sender'],
              fuzziness: 'AUTO',
            },
          },
        ];

        if (status) {
          mustClauses.push({ term: { status } });
        }

        const res = await this.client.search({
          index: config.elasticsearch.index,
          query: {
            bool: {
              must: mustClauses,
            },
          },
          sort: [{ createdAt: { order: 'desc' } }],
        });

        return res.hits.hits.map((hit) => hit._source);
      } catch (err: any) {
        console.warn('[Elasticsearch] Search query failed, falling back to database query:', err.message);
      }
    }

    // Database Fallback
    const whereClause: any = {};
    if (status) {
      whereClause.status = status;
    }

    if (query.trim()) {
      whereClause.OR = [
        { recipient: { contains: query } },
        { subject: { contains: query } },
        { body: { contains: query } },
        { sender: { contains: query } },
      ];
    }

    return await prisma.emailJob.findMany({
      where: whereClause,
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
  }
}

export const searchService = new SearchService();
