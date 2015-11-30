var TaskQueue = (function () {
    function TaskQueue() {
        this.list = [];
    }
    TaskQueue.prototype.push = function (task) {
        this.list.push(task);
        return this;
    };
    TaskQueue.prototype.executeAll = function () {
        var originalList = this.list;
        this.list = [];
        originalList.forEach(function (task) { return task(); });
        if (this.list.length) {
            this.executeAll();
        }
        return this;
    };
    return TaskQueue;
})();
var globalTaskQueue = new TaskQueue();
var MockDeferred = (function () {
    function MockDeferred() {
        var _this = this;
        this.isFinished = false;
        this.isResolved = false;
        this.resolveHandlers = [];
        this.rejectHandlers = [];
        this.promise = {
            then: function (onfulfilled, onrejected) {
                return _this.then(onfulfilled, onrejected);
            },
            'catch': function (onrejected) { return _this.then(null, onrejected); }
        };
    }
    MockDeferred.prototype.resolve = function (value) {
        var _this = this;
        if (value && value.then) {
            value.then(function (resolveValue) { return _this.resolve(resolveValue); }, function (reason) { return _this.reject(reason); });
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
    };
    MockDeferred.prototype.resolveList = function (value) {
        var _this = this;
        var originalHandlers = this.resolveHandlers;
        this.resolveHandlers = [];
        originalHandlers.forEach(function (handler) {
            // Add each handle execution into global task queue
            globalTaskQueue.push(function () { return handler(value); });
        });
        // Add resolve list check into global task queue to make sure
        // no new handler is added
        globalTaskQueue.push(function () {
            if (_this.resolveHandlers.length) {
                _this.resolveList(value);
            }
        });
    };
    MockDeferred.prototype.reject = function (reason) {
        if (!this.isFinished) {
            this.isFinished = true;
            this.isResolved = false;
            this.rejectedReason = reason;
            this.rejectList(reason);
        }
        return this;
    };
    MockDeferred.prototype.rejectList = function (reason) {
        var _this = this;
        var originalHandlers = this.rejectHandlers;
        this.rejectHandlers = [];
        originalHandlers.forEach(function (handler) {
            // Add each handle execution into global task queue
            globalTaskQueue.push(function () { return handler(reason); });
        });
        // Add reject list check into global task queue to make sure
        // no new handler is added
        globalTaskQueue.push(function () {
            if (_this.rejectHandlers.length) {
                _this.rejectList(reason);
            }
        });
    };
    MockDeferred.prototype.then = function (onfulfilled, onrejected) {
        if (!onfulfilled && !onrejected)
            return this.promise;
        if (onfulfilled && Object.prototype.toString.apply(onfulfilled) !== '[object Function]') {
            throw new Error('onfulfilled should be a callback function');
        }
        if (onrejected && Object.prototype.toString.apply(onrejected) !== '[object Function]') {
            throw new Error('onrejected should be a callback function');
        }
        var toReturn = new MockDeferred();
        this.resolveHandlers.push(function (value) {
            if (!onfulfilled) {
                toReturn.resolve(value);
                return;
            }
            try {
                var fulfillResult = onfulfilled(value);
                if (fulfillResult && fulfillResult.then) {
                    // A promise is returned
                    fulfillResult.then(function (resolveValue) {
                        toReturn.resolve(resolveValue);
                    }, function (rejectReason) {
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
        this.rejectHandlers.push(function (reason) {
            if (!onrejected) {
                toReturn.reject(reason);
                return;
            }
            try {
                var rejectResult = onrejected(reason);
                if (rejectResult && rejectResult.then) {
                    // A promise is returned
                    rejectResult.then(function (resolveResult) {
                        toReturn.resolve(resolveResult);
                    }, function (rejectReason) {
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
    };
    return MockDeferred;
})();
var MockPromise = (function () {
    function MockPromise(executor) {
        var deferred = new MockDeferred();
        if (executor) {
            executor(function (value) { return deferred.resolve(value); }, function (reason) { return deferred.reject(reason); });
        }
        this.then = function (onfulfilled, onrejected) {
            return deferred.then(onfulfilled, onrejected);
        };
        this.catch = function (onrejected) { return deferred.then(null, onrejected); };
    }
    MockPromise.all = function (values) {
        var deferred = new MockDeferred();
        var resolveFlags = [];
        resolveFlags.length = values.length;
        for (var index = 0; index < resolveFlags.length; index++) {
            resolveFlags[index] = false;
        }
        var resolveResults = [];
        resolveResults.length = values.length;
        function checkAllResolved() {
            if (resolveFlags.every(function (i) { return i; })) {
                deferred.resolve(resolveResults);
            }
        }
        values.forEach(function (value, index) {
            if (value && value.then) {
                value.then(function (resolveValue) {
                    resolveFlags[index] = true;
                    resolveResults[index] = resolveValue;
                    checkAllResolved();
                }, function (reason) { return deferred.reject(reason); });
            }
            else {
                resolveFlags[index] = true;
                resolveResults[index] = value;
                checkAllResolved();
            }
        });
        return deferred.promise;
    };
    MockPromise.race = function (values) {
        var deferred = new MockDeferred();
        values.forEach(function (value) {
            if (value && value.then) {
                value.then(function (resolveValue) { return deferred.resolve(resolveValue); }, function (reason) { return deferred.reject(reason); });
            }
            else {
                deferred.resolve(value);
            }
        });
        return deferred.promise;
    };
    MockPromise.reject = function (reason) {
        var deferred = new MockDeferred();
        deferred.reject(reason);
        return deferred.promise;
    };
    MockPromise.resolve = function (value) {
        var deferred = new MockDeferred();
        deferred.resolve(value);
        return deferred.promise;
    };
    MockPromise.flushPendingPromises = function () {
        globalTaskQueue.executeAll();
    };
    return MockPromise;
})();
var originalPromises = [];
function mockPromise() {
    var originalPromise = Promise;
    if (originalPromise === MockPromise)
        return;
    if (originalPromises.length && originalPromises[originalPromises.length - 1] === originalPromise)
        return;
    originalPromises.push(originalPromise);
    Promise = MockPromise;
}
exports.mockPromise = mockPromise;
function unmockPromise() {
    var currentPromise = Promise;
    if (currentPromise !== MockPromise || !originalPromises.length)
        return;
    var lastPromise = originalPromises.pop();
    Promise = lastPromise;
}
exports.unmockPromise = unmockPromise;
