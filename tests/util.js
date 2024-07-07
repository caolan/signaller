// @ts-check

/**
 * Returns a promise which resolves after a timeout.
 * 
 * @param {number} ms - Number of milliseconds to wait
 * @returns {Promise<void>} A promise which resolves after the timeout
 */
export function timeout(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}
