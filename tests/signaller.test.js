// @ts-check

import { assertEquals, assertThrows } from "@std/assert";
import { Signaller, watch } from "../src/signaller.js";
import { timeout } from "./util.js";

Deno.test("Multiple sync signals only calls watch handler once", async () => {
    const s = new Signaller(0);
    let counter = 0;

    watch([s], () => {
        counter++;
    });

    s.value = 1;
    s.value = 2;
    s.value = 3;
    await timeout(0);

    assertEquals(counter, 1);
});

Deno.test("Async signals calls watch handler each time", async () => {
    const s = new Signaller(0);
    let counter = 0;

    watch([s], () => {
        counter++;
    });

    s.value = 1;
    await timeout(0);
    s.value = 2;
    await timeout(0);
    s.value = 3;
    await timeout(0);

    assertEquals(counter, 3);
});

Deno.test("Signaller can set itself via sync assignment", async () => {
    const s = new Signaller(0);
    let counter = 0;

    watch([s], () => {
        counter++;
        if (counter === 1) {
            s.value = 2;
        }
    });

    s.value = 1;
    await timeout(0);

    assertEquals(counter, 2);
});

Deno.test("Signaller can set itself via async assignment", async () => {
    const s = new Signaller(0);
    let counter = 0;

    watch([s], async () => {
        counter++;
        if (counter === 1) {
            await timeout(0);
            s.value = 2;
        }
    });

    s.value = 1;
    await timeout(0);
    await timeout(0);

    assertEquals(counter, 2);
});

Deno.test("If watch handler sets value, subsequent handler still called once", async () => {
    const s = new Signaller(0);
    let counter1 = 0;
    let counter2 = 0;

    watch([s], () => {
        counter1++;
        if (counter1 === 1) {
            s.value = 2;
        }
    });

    watch([s], () => {
        counter2++;
    });

    s.value = 1;
    await timeout(0);

    assertEquals(counter1, 2);
    assertEquals(counter2, 1);
});

Deno.test("Async watch handler does not miss set during fullfillment", async () => {
    const s = new Signaller(0);
    let counter1 = 0;
    let counter2 = 0;

    watch([s], async function one() {
        counter1++;
        await timeout(0);
        if (counter1 <= 2) {
            s.value++;
        }
    });

    watch([s], async function two() {
        counter2++;
        await timeout(0);
        await timeout(0);
    });

    s.value++;
    await timeout(0);
    await timeout(0);
    await timeout(0);
    await timeout(0);

    assertEquals(counter1, 3);
    assertEquals(counter2, 2);
});

Deno.test("Signal multiple", async () => {
    const foo = new Signaller(0);
    const bar = new Signaller(0);
    const baz = new Signaller(0);
    /*** @type {Signaller<number>[][]} */
    const calls = [];

    watch([foo, bar, baz], changed => {
        calls.push(changed);
    });

    foo.value++;
    baz.value++;
    foo.value++;
    await timeout(0);
    bar.value++;
    await timeout(0);
    foo.value++;
    bar.value++;
    bar.value++;
    await timeout(0);

    assertEquals(calls, [
        [foo, baz],
        [bar],
        [foo, bar],
    ]);
});

Deno.test("Signal multiple, collect concurrent signals during fulfillment", async () => {
    const foo = new Signaller(0);
    const bar = new Signaller(0);
    const baz = new Signaller(0);
    /*** @type {Signaller<number>[][]} */
    const calls = [];

    watch([foo, bar, baz], async changed => {
        calls.push(changed);
        await timeout(0);
        await timeout(0);
    });

    foo.value++;
    baz.value++;
    foo.value++;
    await timeout(0);
    bar.value++;
    baz.value++;
    await timeout(0);
    foo.value++;
    bar.value++;
    bar.value++;
    await timeout(0);
    await timeout(0);
    await timeout(0);

    assertEquals(calls, [
        [foo, baz],
        [bar, baz, foo],
    ]);
});

Deno.test("Stop while signal queued", async () => {
    const s = new Signaller(0);
    let calls = 0;

    const stop = watch([s], async () => {
        calls++;
        await timeout(0);
        await timeout(0);
    });

    s.value++;
    await timeout(0);
    s.value++;
    stop();
    await timeout(0);
    await timeout(0);
    await timeout(0);

    assertEquals(calls, 1);
});

Deno.test("Stop before first call", async () => {
    const s = new Signaller(0);
    let calls = 0;

    const stop = watch([s], () => {
        calls++;
    });

    s.value++;
    stop();
    await timeout(0);

    assertEquals(calls, 0);
});

Deno.test("Stop while handler is executing followed by subsequent set", async () => {
    const s = new Signaller(0);
    let calls = 0;

    const stop = watch([s], async () => {
        calls++;
        await timeout(0);
        await timeout(0);
    });

    s.value++;
    await timeout(0);
    stop();
    await timeout(0);
    await timeout(0);
    s.value++;
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

    assertEquals(s.value, 123);
    await timeout(0);
    s.value = 456;
    await timeout(0);
    assertEquals(s.value, 456);
    s.value = 789;
    s.value = 0;
    await timeout(0);

    assertEquals(s.value, 0);
    assertEquals(counter, 2);
});

Deno.test("Setting same value does not call callbacks", async () => {
    const s = new Signaller(123);
    let counter = 0;

    watch([s], () => {
        counter++;
    });

    assertEquals(s.value, 123);
    s.value = 123;
    await timeout(0);

    assertEquals(s.value, 123);
    assertEquals(counter, 0);
});

Deno.test("Manually wake handler via signal()", async () => {
    const s = new Signaller(0);
    let counter = 0;

    watch([s], () => {
        counter++;
    });

    s.signal();
    await timeout(0);
    s.signal();
    s.signal();
    s.signal();
    await timeout(0);

    assertEquals(counter, 2);
});

Deno.test("Add and remove callbacks", async () => {
    const s = new Signaller('test');
    /** @type {string[]} */
    const calls = [];

    /** @param {string} value */
    function makeCallback(value) {
        return () => calls.push(value);
    }

    const one = makeCallback('one');
    const two = makeCallback('two');
    const three = makeCallback('three');
    const four = makeCallback('four');
    const five = makeCallback('five');

    s.addCallback(one);
    s.addCallback(two);
    s.addCallback(three);
    s.addCallback(four);
    s.addCallback(five);

    s.removeCallback(three);
    s.removeCallback(one);

    s.signal();
    await timeout(0);

    assertEquals(calls, ['two', 'four', 'five']);
});
