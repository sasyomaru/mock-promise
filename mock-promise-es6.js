class TaskQueue {
    constructor() {
        this.list = [];
    }
    push(task) {
        this.list.push(task);
        return this;
    }
    executeAll() {
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
class MockDeferred {
    constructor() {
        this.isFinished = false;
        this.isResolved = false;
        this.resolveHandlers = [];
        this.rejectHandlers = [];
        this.promise = {
            then: (onfulfilled, onrejected) => this.then(onfulfilled, onrejected),
            'catch': (onrejected) => this.then(null, onrejected)
        };
    }
    resolve(value) {
        if (value && value.then) {
            value.then((resolveValue) => this.resolve(resolveValue), (reason) => this.reject(reason));
        }
        else {
            if (!this.isFinished) {
                this.isFinished = true;
                this.isResolved = true;
                this.resolvedValue = value;
                this.resolveList(value);
            }
        }
        return this;
    }
    resolveList(value) {
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
    reject(reason) {
        if (!this.isFinished) {
            this.isFinished = true;
            this.isResolved = false;
            this.rejectedReason = reason;
            this.rejectList(reason);
        }
        return this;
    }
    rejectList(reason) {
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
    then(onfulfilled, onrejected) {
        if (!onfulfilled && !onrejected)
            return this.promise;
        if (onfulfilled && Object.prototype.toString.apply(onfulfilled) !== '[object Function]') {
            throw new Error('onfulfilled should be a callback function');
        }
        if (onrejected && Object.prototype.toString.apply(onrejected) !== '[object Function]') {
            throw new Error('onrejected should be a callback function');
        }
        var toReturn = new MockDeferred();
        this.resolveHandlers.push((value) => {
            if (!onfulfilled) {
                toReturn.resolve(value);
                return;
            }
            try {
                var fulfillResult = onfulfilled(value);
                if (fulfillResult && fulfillResult.then) {
                    // A promise is returned
                    fulfillResult.then((resolveValue) => {
                        toReturn.resolve(resolveValue);
                    }, (rejectReason) => {
                        toReturn.reject(rejectReason);
                    });
                }
                else {
                    toReturn.resolve(fulfillResult);
                }
            }
            catch (error) {
                toReturn.reject(error);
            }
        });
        this.rejectHandlers.push((reason) => {
            if (!onrejected) {
                toReturn.reject(reason);
                return;
            }
            try {
                var rejectResult = onrejected(reason);
                if (rejectResult && rejectResult.then) {
                    // A promise is returned
                    rejectResult.then((resolveResult) => {
                        toReturn.resolve(resolveResult);
                    }, (rejectReason) => {
                        toReturn.reject(rejectReason);
                    });
                }
                else {
                    toReturn.resolve(rejectResult);
                }
            }
            catch (error) {
                toReturn.reject(error);
            }
        });
        if (this.isFinished) {
            if (this.isResolved) {
                this.resolve(this.resolvedValue);
            }
            else {
                this.reject(this.rejectedReason);
            }
        }
        return toReturn.promise;
    }
}
class MockPromise {
    constructor(executor) {
        var deferred = new MockDeferred();
        if (executor) {
            executor((value) => deferred.resolve(value), (reason) => deferred.reject(reason));
        }
        this.then = (onfulfilled, onrejected) => deferred.then(onfulfilled, onrejected);
        this.catch = (onrejected) => deferred.then(null, onrejected);
    }
    static all(values) {
        var deferred = new MockDeferred();
        var resolveFlags = [];
        resolveFlags.length = values.length;
        for (var index = 0; index < resolveFlags.length; index++) {
            resolveFlags[index] = false;
        }
        var resolveResults = [];
        resolveResults.length = values.length;
        function checkAllResolved() {
            if (resolveFlags.every(i => i)) {
                deferred.resolve(resolveResults);
            }
        }
        values.forEach((value, index) => {
            if (value && value.then) {
                value.then((resolveValue) => {
                    resolveFlags[index] = true;
                    resolveResults[index] = resolveValue;
                    checkAllResolved();
                }, (reason) => deferred.reject(reason));
            }
            else {
                resolveFlags[index] = true;
                resolveResults[index] = value;
                checkAllResolved();
            }
        });
        return deferred.promise;
    }
    static race(values) {
        var deferred = new MockDeferred();
        values.forEach((value) => {
            if (value && value.then) {
                value.then((resolveValue) => deferred.resolve(resolveValue), (reason) => deferred.reject(reason));
            }
            else {
                deferred.resolve(value);
            }
        });
        return deferred.promise;
    }
    static reject(reason) {
        var deferred = new MockDeferred();
        deferred.reject(reason);
        return deferred.promise;
    }
    static resolve(value) {
        var deferred = new MockDeferred();
        deferred.resolve(value);
        return deferred.promise;
    }
    static flushPendingPromises() {
        globalTaskQueue.executeAll();
    }
}
var originalPromises = [];
export function mockPromise() {
    var originalPromise = Promise;
    if (originalPromise === MockPromise)
        return;
    if (originalPromises.length && originalPromises[originalPromises.length - 1] === originalPromise)
        return;
    originalPromises.push(originalPromise);
    Promise = MockPromise;
}
export function unmockPromise() {
    var currentPromise = Promise;
    if (currentPromise !== MockPromise || !originalPromises.length)
        return;
    var lastPromise = originalPromises.pop();
    Promise = lastPromise;
}
