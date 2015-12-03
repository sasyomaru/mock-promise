mock-promise
====
A ES2015-compatible Promise implementation without initializing a PendingJob, which is useful when writing code for unit test.

## Introduction
According to [ES2015 specification](http://www.ecma-international.org/ecma-262/6.0/index.html#sec-triggerpromisereactions), the promise reactions (resolve / reject handlers) are run in separate [jobs](http://www.ecma-international.org/ecma-262/6.0/index.html#sec-jobs-and-job-queues). This will result in that all tests related to Promise have to be asynchronous test, which will not end quickly when having problems.

mock-promise is designed with following targets:
1. ES2015-compatible
2. No separate job created
3. Keep stack trace for running context of promise reactions as simple as possible
4. Not execute promise reactions immediately when promise is resolved / rejected, to follow Promise's design.
 
## Install
mock-promise can be installed via [bower](http://bower.io/). You can use the following command to get mock-promise.
`bower install mock-promise`
The package contains the source file, which is written in TypeScript, and distribution packages for different module loaders (AMD, or ES2015). Use the one most suitable for your environment.

## API
The package has three APIs in total.

1. mockPromise(): void. By calling this, the Promise in global environment will be replaced with the mock Promise implementation. It's suggested to be used in the "setup" stage of test. The original Promise will be stored at some place to be restored later. Don't call this API multiple times before calling unmockPromise unless you know what it means (by reading code).
2. unmockPromise(): void. By calling this, the original Promise will be restored to the global environment. It's suggested to be used in the "teardown" stage of test. Don't call this API multiple times before calling another mockPromise unless you know what it means (by reading code).
3. Promise.flushPendingPromises(): void. Promise's reactions will not be executed even after the Promise is resolved / rejected, until this API is called. Attention that all the reactions for Promises registered during this "flush" will be executed as well. This design is to prevent people from memorizing how many times this "flush" API should be called to get the target Promise reactions executed.

## How to use
In general, you can use mock-promise in 5 steps:

1. Call mockPromise() in the setup stage of test
2. Write your code as you use to do
3. Run Promise.flushPendingPromise() to execute all Promise reactions.
4. Validate result in your test as you use to do
5. Call unmockPromise() in the teardown stage of test

Here is an example code of test based on Jasmine. You can find other TypeScript examples in mock-promise_test.ts.
```JavaScript
define(['./mock-promise'], function(MockPromiseUtil) {
    describe('Test via mock-promise', function() {
        beforeEach(function() {
            MockPromiseUtil.mockPromise();
        });
        afterEach(function() {
            MockPromiseUtil.unmockPromise();
        });
        
        function getAddPromise(int a, int b) {
            return Promise.resolve(a + b);
        }
        
        it('should ran Promise reactions only after flushing', function() {
            var resultValue = null;
            getAddPromise(2, 3).then(function(value) {
                resultValue = value;
            });
            // Promise reaction will not be executed before flush
            expect(resultValue).toBeNull();
            Promise.flushPendingPromises();
            // Promise reaction will be executed after flush
            expect(resultValue).toBe(5);
        });
    });
});
```
