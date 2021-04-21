'use strict'

const errCode = require('err-code')
const CID = require('cids')

/**
 * @typedef {Object} Pinnable
 * @property {string | InstanceType<typeof window.String> | CID} [path]
 * @property {CID} [cid]
 * @property {boolean} [recursive]
 * @property {any} [metadata]
 *
 * @typedef {CID|string|InstanceType<typeof window.String>|Pinnable} ToPin
 * @typedef {ToPin|Iterable<ToPin>|AsyncIterable<ToPin>} Source
 *
 * @typedef {Object} Pin
 * @property {string|CID} path
 * @property {boolean} recursive
 * @property {any} [metadata]
 */

/**
 * Transform one of:
 *
 * ```ts
 * CID
 * String
 * { cid: CID recursive, metadata }
 * { path: String recursive, metadata }
 * Iterable<CID>
 * Iterable<String>
 * Iterable<{ cid: CID recursive, metadata }>
 * Iterable<{ path: String recursive, metadata }>
 * AsyncIterable<CID>
 * AsyncIterable<String>
 * AsyncIterable<{ cid: CID recursive, metadata }>
 * AsyncIterable<{ path: String recursive, metadata }>
 * ```
 * Into:
 *
 * ```ts
 * AsyncIterable<{ path: CID|String, recursive:boolean, metadata }>
 * ```
 *
 * @param {import('ipfs-core-types/src/pin').PinSource} input
 * @returns {AsyncIterable<import('ipfs-core-types/src/pin').ToPinWithPath>}
 */
// eslint-disable-next-line complexity
module.exports = async function * normaliseInput (input) {
  // must give us something
  if (input === null || input === undefined) {
    throw errCode(new Error(`Unexpected input: ${input}`), 'ERR_UNEXPECTED_INPUT')
  }

  // CID|String
  if (CID.isCID(input)) {
    yield toPin({ cid: input })
    return
  }

  if (typeof input === 'string' ||
      // @ts-ignore - String instance is not typed
      input instanceof String) {
    yield toPin({ path: input.toString() })
    return
  }

  // { cid: CID recursive, metadata }
  // @ts-ignore - it still could be iterable or async iterable
  if (input.cid != null || input.path != null) {
    // @ts-ignore
    return yield toPin(input)
  }

  // Iterable<?>
  if (input[Symbol.iterator]) {
    const iterator = input[Symbol.iterator]()
    const first = iterator.next()
    if (first.done) return iterator

    // Iterable<CID|String>
    if (CID.isCID(first.value) || first.value instanceof String || typeof first.value === 'string') {
      yield toPin({ cid: first.value })
      for (const cid of iterator) {
        yield toPin({ cid })
      }
      return
    }

    // Iterable<{ cid: CID recursive, metadata }>
    if (first.value.cid != null || first.value.path != null) {
      yield toPin(first.value)
      for (const obj of iterator) {
        yield toPin(obj)
      }
      return
    }

    throw errCode(new Error('Unexpected input: ' + typeof input), 'ERR_UNEXPECTED_INPUT')
  }

  // AsyncIterable<?>
  if (input[Symbol.asyncIterator]) {
    const iterator = input[Symbol.asyncIterator]()
    const first = await iterator.next()
    if (first.done) return iterator

    // AsyncIterable<CID|String>
    if (CID.isCID(first.value) || first.value instanceof String || typeof first.value === 'string') {
      yield toPin({ cid: first.value })
      for await (const cid of iterator) {
        yield toPin({ cid })
      }
      return
    }

    // AsyncIterable<{ cid: CID|String recursive, metadata }>
    if (first.value.cid != null || first.value.path != null) {
      yield toPin(first.value)
      for await (const obj of iterator) {
        yield toPin(obj)
      }
      return
    }

    throw errCode(new Error('Unexpected input: ' + typeof input), 'ERR_UNEXPECTED_INPUT')
  }

  throw errCode(new Error('Unexpected input: ' + typeof input), 'ERR_UNEXPECTED_INPUT')
}

/**
 * @param {import('ipfs-core-types/src/pin').ToPinWithPath|import('ipfs-core-types/src/pin').ToPinWithCID} input
 * @returns {import('ipfs-core-types/src/pin').ToPinWithPath}
 */
function toPin (input) {
  const pin = {
    path: input.path == null ? input.cid : `${input.path}`,
    recursive: input.recursive !== false
  }

  if (input.metadata != null) {
    pin.metadata = input.metadata
  }

  return pin
}
