import { logger } from './logger.js';

describe('Logger', () => {
  test('all methods are callable without throwing', () => {
    expect(() => logger.startup(3001)).not.toThrow();
    expect(() => logger.request('GET', '/api/market', 200, 3)).not.toThrow();
    expect(() => logger.request('POST', '/api/bet', 400, 1)).not.toThrow();
    expect(() => logger.request('POST', '/api/faucet/mm', 500, 120)).not.toThrow();
    expect(() => logger.betPlaced('0xAlice', 10, 'BALL', 'm1', 14.42, 0.73, 0.27)).not.toThrow();
    expect(() => logger.betRejected('0xAlice', 'Market not found')).not.toThrow();
    expect(() => logger.marketOpened('m1')).not.toThrow();
    expect(() => logger.marketClosed('m1')).not.toThrow();
    expect(() => logger.marketResolved('m1', 'BALL', 3, 2, 42.5)).not.toThrow();
    expect(() => logger.gameStateChanged(true)).not.toThrow();
    expect(() => logger.gameStateChanged(false)).not.toThrow();
    expect(() => logger.faucetMM(true)).not.toThrow();
    expect(() => logger.faucetMM(true, 3)).not.toThrow();
    expect(() => logger.faucetMM(false, 1, 'timeout')).not.toThrow();
    expect(() => logger.mmInfoFetched()).not.toThrow();
    expect(() => logger.faucetUser('0xAlice', 100)).not.toThrow();
    expect(() => logger.adminReset()).not.toThrow();
    expect(() => logger.clearnodeConnected('0xMM1234567890')).not.toThrow();
    expect(() => logger.clearnodeDisconnected()).not.toThrow();
    expect(() => logger.wsConnect('0xAlice', 3)).not.toThrow();
    expect(() => logger.wsConnect(null, 1)).not.toThrow();
    expect(() => logger.wsDisconnect('0xBob', 2)).not.toThrow();
    expect(() => logger.wsDisconnect(null, 0)).not.toThrow();
    expect(() => logger.broadcast('ODDS_UPDATE', 5)).not.toThrow();
    expect(() => logger.broadcast('MARKET_STATUS', 1)).not.toThrow();
    expect(() => logger.sendTo('0xAlice', 'BET_RESULT')).not.toThrow();
    expect(() => logger.error('test', new Error('boom'))).not.toThrow();
    expect(() => logger.error('test', 'string error')).not.toThrow();
  });

  test('logger produces no stdout output in test environment', () => {
    const spy = jest.spyOn(process.stdout, 'write').mockImplementation(() => true);

    logger.startup(3001);
    logger.request('GET', '/test', 200, 1);
    logger.betPlaced('0x1', 10, 'BALL', 'm1', 5, 0.6, 0.4);
    logger.betRejected('0x1', 'nope');
    logger.marketOpened('m1');
    logger.marketClosed('m1');
    logger.marketResolved('m1', 'BALL', 1, 0, 10);
    logger.gameStateChanged(true);
    logger.faucetMM(true);
    logger.faucetUser('0x1', 50);
    logger.adminReset();
    logger.clearnodeConnected('0xMM1234567890');
    logger.clearnodeDisconnected();
    logger.wsConnect('0x1', 1);
    logger.wsDisconnect('0x1', 0);
    logger.broadcast('TEST', 2);
    logger.sendTo('0x1', 'MSG');
    logger.error('ctx', new Error('fail'));

    expect(spy).not.toHaveBeenCalled();
    spy.mockRestore();
  });
});
