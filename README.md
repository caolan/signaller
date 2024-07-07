# Signaller

Notify subscribers after a value is updated.

~346 bytes (minified + gzipped).

## Installation

Either use `src/signaller.js` directly as a JavaScript module or install
via a package manager.

```
npm install signaller
```

## Example

```javascript
import {Signaller, watch} from "signaller.js";

// Create some Signallers to hold state.
const name = new Signaller("Pickles");
const count = new Signaller(10);

// Watch state for changes.
watch([name, count], changed => {
    console.log(`${name.current}: ${count.current}`);
});

// Multiple synchronous set() calls will not call the
// watch handler multiple times.
name.set("Bananas");
name.set("Cookies");
count.set(20);

// Hmmm. More cookies, please.
setTimeout(() => count.set(100), 1000);
```

Output:

```
Cookies: 20
Cookies: 100
```

## Tests

```
deno test
```

## Signaller(initial)

Represents a value that may change multiple times. Callbacks may
be added to be called after the next change.

### Properties

#### .current

A read-only property containing the latest value provided to the `set()`
method. Or the initial value provided to the constructor if no `set()`
calls have been made.

### Methods

#### .set(value)

Updates the current value then takes all callbacks from the waiting
list (clearing it) and calls each callback synchronously in the 
order they were added.

#### .addCallback(callback)

Appends a callback to the waiting list that will be called on  the next
`set()`. The callback function is called with this Signaller instance as
its only argument. Its return value is ignored.

#### .removeCallback(callback)

Removes the first matching callback from the waiting list (if 
any). Does nothing if callback has not been registered and will not
throw.

## watch(signallers, handler)

Watches an Array of Signallers for changes.

The handler will always be called asynchronously following a `set()` of
the Signaller. Multiple signals before the next handler completes will not
queue multiple handler calls. This means not every intermediate value of a
Signaller will necessarily be seen by the handler.

The handler receives an Array of Signaller instances that have called
`set()` since the last time the handler was called. If the handler returns
a Promise, the handler will not be called again until the Promise completes.

### Returns

A function to stop watching for changes. After calling this function, the
handler is guaranteed to not be called by again even if a signal is queued.
