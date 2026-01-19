import { describe, it, expect } from 'vitest';
import { CURRENT_STORAGE_VERSION, _testing } from '@/lib/migrations';
import type { RecentDocument, FlowDocument } from '@/types';

const { migrateV1ToV2, migrateV2ToV3, mapSourceToType, extractSourceLabel } = _testing;

describe('Migrations', () => {
  describe('CURRENT_STORAGE_VERSION', () => {
    it('is defined and is a positive integer', () => {
      expect(CURRENT_STORAGE_VERSION).toBeDefined();
      expect(CURRENT_STORAGE_VERSION).toBeGreaterThan(0);
      expect(Number.isInteger(CURRENT_STORAGE_VERSION)).toBe(true);
    });

    it('is at least version 3', () => {
      expect(CURRENT_STORAGE_VERSION).toBeGreaterThanOrEqual(3);
    });
  });

  describe('mapSourceToType', () => {
    it('maps web source to web type', () => {
      expect(mapSourceToType('web')).toBe('web');
    });

    it('maps selection source to web type', () => {
      expect(mapSourceToType('selection')).toBe('web');
    });

    it('maps pdf source to pdf type', () => {
      expect(mapSourceToType('pdf')).toBe('pdf');
    });

    it('maps docx source to docx type', () => {
      expect(mapSourceToType('docx')).toBe('docx');
    });

    it('maps epub source to epub type', () => {
      expect(mapSourceToType('epub')).toBe('epub');
    });

    it('maps mobi source to mobi type', () => {
      expect(mapSourceToType('mobi')).toBe('mobi');
    });

    it('maps paste source to paste type', () => {
      expect(mapSourceToType('paste')).toBe('paste');
    });

    it('defaults unknown source to web type', () => {
      expect(mapSourceToType('unknown')).toBe('web');
      expect(mapSourceToType('')).toBe('web');
    });
  });

  describe('extractSourceLabel', () => {
    it('extracts hostname from URL', () => {
      const doc: RecentDocument = {
        id: '1',
        title: 'Test',
        source: 'web',
        timestamp: 1000,
        preview: 'Preview',
        url: 'https://example.com/article/123',
      };
      expect(extractSourceLabel(doc)).toBe('example.com');
    });

    it('handles URL with www prefix', () => {
      const doc: RecentDocument = {
        id: '1',
        title: 'Test',
        source: 'web',
        timestamp: 1000,
        preview: 'Preview',
        url: 'https://www.example.com/article',
      };
      expect(extractSourceLabel(doc)).toBe('www.example.com');
    });

    it('falls back to URL string for invalid URL', () => {
      const doc: RecentDocument = {
        id: '1',
        title: 'Test',
        source: 'web',
        timestamp: 1000,
        preview: 'Preview',
        url: 'not-a-valid-url',
      };
      expect(extractSourceLabel(doc)).toBe('not-a-valid-url');
    });

    it('uses fileName from cachedDocument when no URL', () => {
      const mockDoc: FlowDocument = {
        metadata: {
          title: 'Test Doc',
          source: 'pdf',
          createdAt: 1000,
          fileName: 'document.pdf',
        },
        blocks: [],
        plainText: '',
      };
      const doc: RecentDocument = {
        id: '1',
        title: 'Test',
        source: 'pdf',
        timestamp: 1000,
        preview: 'Preview',
        cachedDocument: mockDoc,
      };
      expect(extractSourceLabel(doc)).toBe('document.pdf');
    });

    it('falls back to source when no URL or fileName', () => {
      const doc: RecentDocument = {
        id: '1',
        title: 'Test',
        source: 'paste',
        timestamp: 1000,
        preview: 'Preview',
      };
      expect(extractSourceLabel(doc)).toBe('paste');
    });
  });

  describe('migrateV1ToV2', () => {
    it('creates empty archiveItems when recentDocuments is empty', () => {
      const data = {
        version: 1,
        recentDocuments: [],
        settings: {},
      };

      const result = migrateV1ToV2(data);

      expect(result.archiveItems).toEqual([]);
    });

    it('creates empty archiveItems when recentDocuments is undefined', () => {
      const data = {
        version: 1,
        settings: {},
      };

      const result = migrateV1ToV2(data);

      expect(result.archiveItems).toEqual([]);
    });

    it('migrates recentDocuments to archiveItems', () => {
      const recentDoc: RecentDocument = {
        id: 'doc-1',
        title: 'Test Article',
        source: 'web',
        timestamp: 1000,
        preview: 'Preview text',
        url: 'https://example.com/article',
      };

      const data = {
        version: 1,
        recentDocuments: [recentDoc],
        settings: {},
      };

      const result = migrateV1ToV2(data);

      expect(result.archiveItems).toHaveLength(1);
      const item = (result.archiveItems as unknown[])[0] as Record<string, unknown>;
      expect(item.id).toBe('doc-1');
      expect(item.title).toBe('Test Article');
      expect(item.type).toBe('web');
      expect(item.sourceLabel).toBe('example.com');
      expect(item.url).toBe('https://example.com/article');
      expect(item.createdAt).toBe(1000);
      expect(item.lastOpenedAt).toBe(1000);
    });

    it('migrates multiple documents', () => {
      const docs: RecentDocument[] = [
        {
          id: 'doc-1',
          title: 'Web Article',
          source: 'web',
          timestamp: 1000,
          preview: 'Preview',
          url: 'https://example.com',
        },
        {
          id: 'doc-2',
          title: 'PDF Document',
          source: 'pdf',
          timestamp: 2000,
          preview: 'Preview',
        },
      ];

      const data = {
        version: 1,
        recentDocuments: docs,
      };

      const result = migrateV1ToV2(data);

      expect(result.archiveItems).toHaveLength(2);
    });

    it('preserves cachedDocument in archive item', () => {
      const mockDoc: FlowDocument = {
        metadata: {
          title: 'Test Doc',
          source: 'pdf',
          createdAt: 1000,
          fileHash: 'abc123',
        },
        blocks: [{ type: 'paragraph', content: 'Test', id: 'p1' }],
        plainText: 'Test',
      };

      const recentDoc: RecentDocument = {
        id: 'doc-1',
        title: 'Test',
        source: 'pdf',
        timestamp: 1000,
        preview: 'Preview',
        cachedDocument: mockDoc,
      };

      const data = {
        version: 1,
        recentDocuments: [recentDoc],
      };

      const result = migrateV1ToV2(data);

      const item = (result.archiveItems as unknown[])[0] as Record<string, unknown>;
      expect(item.cachedDocument).toBe(mockDoc);
      expect(item.fileHash).toBe('abc123');
    });

    it('skips migration if archiveItems already exists', () => {
      const existingItems = [{ id: 'existing-item' }];
      const data = {
        version: 1,
        recentDocuments: [{ id: 'new-item' }],
        archiveItems: existingItems,
      };

      const result = migrateV1ToV2(data);

      expect(result.archiveItems).toBe(existingItems);
    });

    it('preserves other data fields', () => {
      const data = {
        version: 1,
        recentDocuments: [],
        settings: { theme: 'dark' },
        customField: 'value',
      };

      const result = migrateV1ToV2(data);

      expect(result.settings).toEqual({ theme: 'dark' });
      expect(result.customField).toBe('value');
    });
  });

  describe('migrateV2ToV3', () => {
    it('adds sync-related fields', () => {
      const data = {
        version: 2,
        settings: {},
        archiveItems: [],
      };

      const result = migrateV2ToV3(data);

      expect(result.syncEnabled).toBe(false);
      expect(result.syncProvider).toBeNull();
      expect(result.lastSyncTime).toBeNull();
      expect(result.lastSyncError).toBeNull();
    });

    it('generates deviceId if not present', () => {
      const data = {
        version: 2,
        settings: {},
      };

      const result = migrateV2ToV3(data);

      expect(result.deviceId).toBeDefined();
      expect(typeof result.deviceId).toBe('string');
      expect((result.deviceId as string).length).toBe(32); // 16 bytes in hex
    });

    it('preserves existing deviceId', () => {
      const data = {
        version: 2,
        deviceId: 'existing-device-id',
        settings: {},
      };

      const result = migrateV2ToV3(data);

      expect(result.deviceId).toBe('existing-device-id');
    });

    it('preserves other data fields', () => {
      const data = {
        version: 2,
        settings: { theme: 'light' },
        archiveItems: [{ id: '1' }],
        positions: { 'doc-1': { blockIndex: 5 } },
      };

      const result = migrateV2ToV3(data);

      expect(result.settings).toEqual({ theme: 'light' });
      expect(result.archiveItems).toEqual([{ id: '1' }]);
      expect(result.positions).toEqual({ 'doc-1': { blockIndex: 5 } });
    });
  });

  describe('migration chain', () => {
    it('v1 -> v2 -> v3 migration preserves data', () => {
      const v1Data = {
        version: 1,
        recentDocuments: [
          {
            id: 'doc-1',
            title: 'Test Article',
            source: 'web',
            timestamp: 1000,
            preview: 'Preview',
            url: 'https://example.com',
          },
        ],
        settings: { theme: 'dark' },
        positions: { 'doc-1': { blockIndex: 10 } },
      };

      // Run v1 -> v2
      const v2Data = migrateV1ToV2(v1Data);
      expect(v2Data.archiveItems).toHaveLength(1);

      // Run v2 -> v3
      const v3Data = migrateV2ToV3(v2Data);

      // Verify all data is preserved
      expect(v3Data.archiveItems).toHaveLength(1);
      expect(v3Data.settings).toEqual({ theme: 'dark' });
      expect(v3Data.positions).toEqual({ 'doc-1': { blockIndex: 10 } });
      expect(v3Data.syncEnabled).toBe(false);
      expect(v3Data.deviceId).toBeDefined();
    });
  });
});
