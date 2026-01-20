import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// We need to test the logger without actually checking import.meta.env.DEV
// since tests run in a controlled environment
import { createLogger, logDeprecation, devAssert, timeOperation } from '@/lib/logger';

describe('Logger Utility', () => {
  beforeEach(() => {
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'debug').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('createLogger', () => {
    it('creates a logger with the specified module name', () => {
      const log = createLogger('TestModule');
      log.info('test message');
      
      expect(console.log).toHaveBeenCalledWith('[FlowReader:TestModule]', 'test message');
    });

    it('logs debug messages to console.debug', () => {
      const log = createLogger('Debug');
      log.debug('debug info');
      
      expect(console.debug).toHaveBeenCalledWith('[FlowReader:Debug]', 'debug info');
    });

    it('logs info messages to console.log', () => {
      const log = createLogger('Info');
      log.info('info message');
      
      expect(console.log).toHaveBeenCalledWith('[FlowReader:Info]', 'info message');
    });

    it('logs warn messages to console.warn', () => {
      const log = createLogger('Warn');
      log.warn('warning message');
      
      expect(console.warn).toHaveBeenCalledWith('[FlowReader:Warn]', 'warning message');
    });

    it('logs error messages to console.error', () => {
      const log = createLogger('Error');
      log.error('error message');
      
      expect(console.error).toHaveBeenCalledWith('[FlowReader:Error]', 'error message');
    });

    it('accepts multiple arguments', () => {
      const log = createLogger('Multi');
      log.info('message', { data: 123 }, 'more');
      
      expect(console.log).toHaveBeenCalledWith('[FlowReader:Multi]', 'message', { data: 123 }, 'more');
    });

    it('creates child loggers with nested module names', () => {
      const log = createLogger('Parent');
      const childLog = log.child('Child');
      childLog.info('child message');
      
      expect(console.log).toHaveBeenCalledWith('[FlowReader:Parent:Child]', 'child message');
    });

    it('forceError always logs', () => {
      const log = createLogger('Force');
      log.forceError('critical error');
      
      expect(console.error).toHaveBeenCalledWith('[FlowReader:Force]', 'critical error');
    });
  });

  describe('logDeprecation', () => {
    it('logs deprecation warning', () => {
      logDeprecation('oldFunction is deprecated');
      
      expect(console.warn).toHaveBeenCalledWith(
        '[FlowReader:Deprecated] oldFunction is deprecated'
      );
    });

    it('includes replacement suggestion when provided', () => {
      logDeprecation('oldFunction is deprecated', 'newFunction');
      
      expect(console.warn).toHaveBeenCalledWith(
        '[FlowReader:Deprecated] oldFunction is deprecated Use newFunction instead.'
      );
    });
  });

  describe('devAssert', () => {
    it('does not throw when condition is truthy', () => {
      expect(() => devAssert(true, 'should not throw')).not.toThrow();
      expect(() => devAssert(1, 'should not throw')).not.toThrow();
      expect(() => devAssert('value', 'should not throw')).not.toThrow();
      expect(() => devAssert({}, 'should not throw')).not.toThrow();
    });

    it('throws when condition is falsy', () => {
      expect(() => devAssert(false, 'assertion failed')).toThrow('Assertion failed: assertion failed');
      expect(() => devAssert(null, 'null check')).toThrow('Assertion failed: null check');
      expect(() => devAssert(undefined, 'undefined check')).toThrow('Assertion failed: undefined check');
      expect(() => devAssert(0, 'zero check')).toThrow('Assertion failed: zero check');
      expect(() => devAssert('', 'empty string')).toThrow('Assertion failed: empty string');
    });

    it('logs error details when assertion fails', () => {
      try {
        devAssert(false, 'test assertion', { extra: 'data' });
      } catch {
        // Expected
      }
      
      expect(console.error).toHaveBeenCalledWith(
        '[FlowReader:Assert]',
        'test assertion',
        { extra: 'data' }
      );
    });
  });

  describe('timeOperation', () => {
    it('returns a function to complete timing', () => {
      const done = timeOperation('Test', 'operation');
      expect(typeof done).toBe('function');
    });

    it('logs timing when done is called', () => {
      vi.spyOn(performance, 'now')
        .mockReturnValueOnce(1000)
        .mockReturnValueOnce(1500);
      
      const done = timeOperation('Test', 'operation');
      done();
      
      expect(console.log).toHaveBeenCalledWith('[FlowReader:Test] operation took 500ms');
    });

    it('rounds timing to nearest millisecond', () => {
      vi.spyOn(performance, 'now')
        .mockReturnValueOnce(1000)
        .mockReturnValueOnce(1234.7);
      
      const done = timeOperation('Timing', 'precise op');
      done();
      
      expect(console.log).toHaveBeenCalledWith('[FlowReader:Timing] precise op took 235ms');
    });
  });
});
