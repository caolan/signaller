// @ts-check

import { assertEquals, assertThrows } from "@std/assert";
import { Signaller, watch } from "../src/signaller.js";
import { timeout } from "./util.js";

Deno.test("Multiple sync signals only calls watch handler once", async () => {
    const s = new Signaller(null);
    let counter = 0;

    watch([s], () => {
        counter++;
    });

    s.set(null);
    s.set(null);
    s.set(null);
    await timeout(0);

    assertEquals(counter, 1);
});

Deno.test("Async signals calls watch handler each time", async () => {
    const s = new Signaller(null);
    let counter = 0;

    watch([s], () => {
        counter++;
    });

    s.set(null);
    await timeout(0);
    s.set(null);
    await timeout(0);
    s.set(null);
    await timeout(0);

    assertEquals(counter, 3);
});

Deno.test("Signaller can set itself via sync set(null)", async () => {
    const s = new Signaller(null);
    let counter = 0;

    watch([s], () => {
        counter++;
        if (counter === 1) {
            s.set(null);
        }
    });

    s.set(null);
    await timeout(0);

    assertEquals(counter, 2);
});

Deno.test("Signaller can set itself via async set(null)", async () => {
    const s = new Signaller(null);
    let counter = 0;

    watch([s], async () => {
        counter++;
        if (counter === 1) {
            await timeout(0);
            s.set(null);
        }
    });

    s.set(null);
    await timeout(0);
    await timeout(0);

    assertEquals(counter, 2);
});

Deno.test("If watch handler calls set(), subsequent handler still called once", async () => {
    const s = new Signaller(null);
    let counter1 = 0;
    let counter2 = 0;

    watch([s], () => {
        counter1++;
        if (counter1 === 1) {
            s.set(null);
        }
    });

    watch([s], () => {
        counter2++;
    });

    s.set(null);
    await timeout(0);

    assertEquals(counter1, 2);
    assertEquals(counter2, 1);
});

Deno.test("Async watch handler does not miss set during fullfillment", async () => {
    const s = new Signaller(null);
    let counter1 = 0;
    let counter2 = 0;

    watch([s], async function one() {
        counter1++;
        await timeout(0);
        if (counter1 <= 2) {
            s.set(null);
        }
    });

    watch([s], async function two() {
        counter2++;
        await timeout(0);
        await timeout(0);
    });

    s.set(null);
    await timeout(0);
    await timeout(0);
    await timeout(0);
    await timeout(0);

    assertEquals(counter1, 3);
    assertEquals(counter2, 2);
});

Deno.test("Signal multiple", async () => {
    const foo = new Signaller(null);
    const bar = new Signaller(null);
    const baz = new Signaller(null);
    /*** @type {Signaller<null>[][]} */
    const calls = [];

    watch([foo, bar, baz], changed => {
        calls.push(changed);
    });

    foo.set(null);
    baz.set(null);
    foo.set(null);
    await timeout(0);
    bar.set(null);
    await timeout(0);
    foo.set(null);
    bar.set(null);
    bar.set(null);
    await timeout(0);

    assertEquals(calls, [
        [foo, baz],
        [bar],
        [foo, bar],
    ]);
});

Deno.test("Signal multiple, collect concurrent signals during fulfillment", async () => {
    const foo = new Signaller(null);
    const bar = new Signaller(null);
    const baz = new Signaller(null);
    /*** @type {Signaller<null>[][]} */
    const calls = [];

    watch([foo, bar, baz], async changed => {
        calls.push(changed);
        await timeout(0);
        await timeout(0);
    });

    foo.set(null);
    baz.set(null);
    foo.set(null);
    await timeout(0);
    bar.set(null);
    baz.set(null);
    await timeout(0);
    foo.set(null);
    bar.set(null);
    bar.set(null);
    await timeout(0);
    await timeout(0);
    await timeout(0);

    assertEquals(calls, [
        [foo, baz],
        [bar, baz, foo],
    ]);
});

Deno.test("Stop while signal queued", async () => {
    const s = new Signaller(null);
    let calls = 0;

    const stop = watch([s], async () => {
        calls++;
        await timeout(0);
        await timeout(0);
    });

    s.set(null);
    await timeout(0);
    s.set(null);
    stop();
    await timeout(0);
    await timeout(0);
    await timeout(0);

    assertEquals(calls, 1);
});

Deno.test("Stop before first call", async () => {
    const s = new Signaller(null);
    let calls = 0;

    const stop = watch([s], () => {
        calls++;
    });

    s.set(null);
    stop();
    await timeout(0);

    assertEquals(calls, 0);
});

Deno.test("Stop while handler is executing followed by subsequent set", async () => {
    const s = new Signaller(null);
    let calls = 0;

    const stop = watch([s], async () => {
        calls++;
        await timeout(0);
        await timeout(0);
    });

    s.set(null);
    await timeout(0);
    stop();
    await timeout(0);
    await timeout(0);
    s.set(null);
    await timeout(0);
    await timeout(0);

    assertEquals(calls, 1);
});

Deno.test("Setting different value", async () => {
    const s = new Signaller(123);
    const s2 = new Signaller('st');
    let counter = 0;

    watch([s, s2], _changes => {
        counter++;
    });

    assertEquals(s.current, 123);
    await timeout(0);
    s.set(456);
    await timeout(0);
    assertEquals(s.current, 456);
    s.set(789);
    s.set(0);
    await timeout(0);

    assertEquals(s.current, 0);
    assertEquals(counter, 2);
});

Deno.test("Setting same value still calls callbacks", async () => {
    const s = new Signaller(123);
    let counter = 0;

    watch([s], () => {
        counter++;
    });

    assertEquals(s.current, 123);
    s.set(123);
    await timeout(0);

    assertEquals(s.current, 123);
    assertEquals(counter, 1);
});

Deno.test("Attempting to overwrite current property", async () => {
    const s = new Signaller(123);
    let counter = 0;

    watch([s], () => {
        counter++;
    });

    assertEquals(s.current, 123);
    assertThrows(() => {
        /** @type any */(s).current = 456;
        assertEquals(s.current, 123);
    });
    await timeout(0);

    assertEquals(s.current, 123);
    assertEquals(counter, 0);
});
