import {mockPromise, unmockPromise} from './mock-promise';

describe('Mock Promise', () => {
    beforeEach(() => {
        mockPromise();
    });
    afterEach(() => {
        unmockPromise();
    });

    it('should ran resolve / reject handler only when flushing promises', () => {
        var promise = Promise.resolve(3);
        var value: any = null;
        promise.then((newValue) => value = newValue);
        expect(value).toBeNull();
        (<any>Promise).flushPendingPromises();
        expect(value).toBe(3);
    });

    it ('should ran embedded resolve / reject handler as well when flushing promises', () => {
        var promise = Promise.resolve(3);
        var value: any = null;
        promise.then(newValue => Promise.resolve(newValue + 1)).then(newValue => value = newValue);
        expect(value).toBeNull();
        (<any>Promise).flushPendingPromises();
        expect(value).toBe(4);
    });
});
