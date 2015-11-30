interface IPromiseLike<T> {
    /**
     * Attaches callbacks for the resolution and/or rejection of the Promise.
     * @param onfulfilled The callback to execute when the Promise is resolved.
     * @param onrejected The callback to execute when the Promise is rejected.
     * @returns A Promise for the completion of which ever callback is executed.
     */
    then<TResult>(
        onfulfilled?: (value: T) => TResult | IPromiseLike<TResult>,
        onrejected?: (reason: any) => TResult | IPromiseLike<TResult>): IPromiseLike<TResult>;
    then<TResult>(
        onfulfilled?: (value: T) => TResult | IPromiseLike<TResult>,
        onrejected?: (reason: any) => void): IPromiseLike<TResult>;
}


/**
 * Represents the completion of an asynchronous operation
 */
interface IPromise<T> {
    /**
     * Attaches callbacks for the resolution and/or rejection of the Promise.
     * @param onfulfilled The callback to execute when the Promise is resolved.
     * @param onrejected The callback to execute when the Promise is rejected.
     * @returns A Promise for the completion of which ever callback is executed.
     */
    then<TResult>(
        onfulfilled?: (value: T) => TResult | IPromiseLike<TResult>,
        onrejected?: (reason: any) => TResult | IPromiseLike<TResult>): IPromise<TResult>;
    then<TResult>(
        onfulfilled?: (value: T) => TResult | IPromiseLike<TResult>,
        onrejected?: (reason: any) => void): IPromise<TResult>;

    /**
     * Attaches a callback for only the rejection of the Promise.
     * @param onrejected The callback to execute when the Promise is rejected.
     * @returns A Promise for the completion of the callback.
     */
    catch(onrejected?: (reason: any) => T | IPromiseLike<T>): IPromise<T>;
    catch(onrejected?: (reason: any) => void): IPromise<T>;
}

class TaskQueue {
    private list: Array<() => any> = [];

    public push(task: () => any) {
        this.list.push(task);
        return this;
    }

    public executeAll() {
        var originalList = this.list;
        this.list = [];
        originalList.forEach(task => task());
        if (this.list.length) {
            this.executeAll();
        }
        return this;
    }
}
var globalTaskQueue = new TaskQueue();

interface IHandler<T> {
    (value: T): any;
}

class MockDeferred<T> {
    private isFinished = false;
    private isResolved = false;
    private resolvedValue: T;
    private rejectedReason: any;

    private resolveHandlers: IHandler<T>[] = [];
    private rejectHandlers: IHandler<any>[] = [];

    public promise: IPromise<T> = <IPromise<T>>{
        then: <TResult>(onfulfilled?: (value: T) => TResult | IPromiseLike<TResult>,
                        onrejected?: (reason: any) => TResult | IPromiseLike<TResult>) =>
            this.then(onfulfilled, onrejected),
        'catch': (onrejected?: (reason: any) => T | IPromiseLike<T>) => this.then(null, onrejected)
    };

    public resolve(value: any) {
        if (value && value.then) {
            value.then((resolveValue: T) => this.resolve(resolveValue), (reason: any) => this.reject(reason));
        } else {
            if (!this.isFinished) {
                this.isFinished = true;
                this.isResolved = true;
                this.resolvedValue = value;
                this.resolveList(value);
            }
        }
        return this;
    }

    private resolveList(value: T) {
        var originalHandlers = this.resolveHandlers;
        this.resolveHandlers = [];
        originalHandlers.forEach(handler => {
            // Add each handle execution into global task queue
            globalTaskQueue.push(() => handler(value));
        });
        // Add resolve list check into global task queue to make sure
        // no new handler is added
        globalTaskQueue.push(() => {
            if (this.resolveHandlers.length) {
                this.resolveList(value);
            }
        });
    }

    public reject(reason: any) {
        if (!this.isFinished) {
            this.isFinished = true;
            this.isResolved = false;
            this.rejectedReason = reason;
            this.rejectList(reason);
        }
        return this;
    }

    private rejectList(reason: any) {
        var originalHandlers = this.rejectHandlers;
        this.rejectHandlers = [];
        originalHandlers.forEach(handler => {
            // Add each handle execution into global task queue
            globalTaskQueue.push(() => handler(reason));
        });
        // Add reject list check into global task queue to make sure
        // no new handler is added
        globalTaskQueue.push(() => {
            if (this.rejectHandlers.length) {
                this.rejectList(reason);
            }
        });
    }

    public then<TResult>(
        onfulfilled?: (value: T) => TResult | IPromiseLike<TResult>,
        onrejected?: (reason: any) => TResult | IPromiseLike<TResult>): IPromise<TResult>;
    public then<TResult>(
        onfulfilled?: (value: T) => TResult | IPromiseLike<TResult>,
        onrejected?: (reason: any) => void): IPromise<TResult>;
    public then<TResult>(
        onfulfilled?: (value: T) => TResult | IPromiseLike<TResult>,
        onrejected?: (reason: any) => any): IPromise<TResult> {
        if (!onfulfilled && !onrejected) return <any>this.promise;
        if (onfulfilled && Object.prototype.toString.apply(onfulfilled) !== '[object Function]') {
            throw new Error('onfulfilled should be a callback function');
        }
        if (onrejected && Object.prototype.toString.apply(onrejected) !== '[object Function]') {
            throw new Error('onrejected should be a callback function');
        }
        var toReturn = new MockDeferred<TResult>();

        this.resolveHandlers.push((value: T) => {
            if (!onfulfilled) {
                toReturn.resolve(value);
                return;
            }
            try {
                var fulfillResult: any = onfulfilled(value);
                if (fulfillResult && fulfillResult.then) {
                    // A promise is returned
                    fulfillResult.then((resolveValue: TResult) => {
                        toReturn.resolve(resolveValue);
                    }, (rejectReason: any) => {
                        toReturn.reject(rejectReason);
                    });
                } else {
                    toReturn.resolve(fulfillResult);
                }
            } catch (error) {
                toReturn.reject(error);
            }
        });

        this.rejectHandlers.push((reason: any) => {
            if (!onrejected) {
                toReturn.reject(reason);
                return;
            }
            try {
                var rejectResult: any = onrejected(reason);
                if (rejectResult && rejectResult.then) {
                    // A promise is returned
                    rejectResult.then((resolveResult: TResult) => {
                        toReturn.resolve(resolveResult);
                    }, (rejectReason: any) => {
                        toReturn.reject(rejectReason);
                    });
                } else {
                    toReturn.resolve(rejectResult);
                }
            } catch (error) {
                toReturn.reject(error);
            }
        });

        if (this.isFinished) {
            if (this.isResolved) {
                this.resolve(this.resolvedValue);
            } else {
                this.reject(this.rejectedReason);
            }
        }

        return toReturn.promise;
    }
}

class MockPromise<T> implements IPromise<T>{
    public then: <TResult>(
        onfulfilled?: (value: T) => TResult | IPromiseLike<TResult>,
        onrejected?: (reason: any) => TResult | IPromiseLike<TResult>) => IPromise<TResult>;

    public catch: (onrejected?: (reason: any) => T | IPromiseLike<T>) => IPromise<T>;

    constructor(executor: (resolve: (value?: T | IPromiseLike<T>) => void, reject: (reason?: any) => void) => void) {
        var deferred = new MockDeferred<T>();
        if (executor) {
            executor(
                (value?: T | IPromiseLike<T>) => deferred.resolve(value),
                (reason?: any) => deferred.reject(reason));
        }

        this.then = <TResult>(onfulfilled?: (value: T) => TResult | IPromiseLike<TResult>,
                              onrejected?: (reason: any) => TResult | IPromiseLike<TResult>) =>
            deferred.then(onfulfilled, onrejected);

        this.catch = (onrejected?: (reason: any) => T | IPromiseLike<T>) => deferred.then(null, onrejected);
    }

    public static all<T>(values: Array<T | IPromiseLike<T>>): IPromise<T[]> {
        var deferred = new MockDeferred<T[]>();
        var resolveFlags: boolean[] = [];
        resolveFlags.length = values.length;
        for (var index = 0; index < resolveFlags.length; index++) {
            resolveFlags[index] = false;
        }
        var resolveResults: T[] = [];
        resolveResults.length = values.length;

        function checkAllResolved() {
            if (resolveFlags.every(i => i)) {
                deferred.resolve(resolveResults);
            }
        }

        values.forEach((value: any, index: number) => {
            if (value && value.then) {
                value.then((resolveValue: T) => {
                    resolveFlags[index] = true;
                    resolveResults[index] = resolveValue;
                    checkAllResolved();
                }, (reason: any) => deferred.reject(reason));
            } else {
                resolveFlags[index] = true;
                resolveResults[index] = value;
                checkAllResolved();
            }
        });
        return deferred.promise;
    }

    public static race<T>(values: Array<T | IPromiseLike<T>>): IPromise<T> {
        var deferred = new MockDeferred<T>();
        values.forEach((value: any) => {
            if (value && value.then) {
                value.then(
                    (resolveValue: T) => deferred.resolve(resolveValue),
                    (reason: any) => deferred.reject(reason));
            } else {
                deferred.resolve(value);
            }
        });
        return deferred.promise;
    }

    public static reject(reason: any): IPromise<void>;
    public static reject<T>(reason: any): IPromise<T> {
        var deferred = new MockDeferred<T>();
        deferred.reject(reason);
        return deferred.promise;
    }

    public static resolve(): IPromise<void>;
    public static resolve<T>(value?: T | IPromiseLike<T>): IPromise<T> {
        var deferred = new MockDeferred<T>();
        deferred.resolve(value);
        return deferred.promise;
    }

    public static flushPendingPromises() {
        globalTaskQueue.executeAll();
    }
}

var originalPromises: any[] = [];

declare var Promise: any;

export function mockPromise() {
    var originalPromise: any = Promise;
    if (originalPromise === MockPromise) return;
    if (originalPromises.length && originalPromises[originalPromises.length - 1] === originalPromise) return;
    originalPromises.push(originalPromise);
    Promise = <any>MockPromise;
}

export function unmockPromise() {
    var currentPromise: any = Promise;
    if (currentPromise !== MockPromise || !originalPromises.length) return;
    var lastPromise = originalPromises.pop();
    Promise = lastPromise;
}
