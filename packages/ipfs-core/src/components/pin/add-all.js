/* eslint max-nested-callbacks: ["error", 8] */
'use strict'

const { resolvePath } = require('../../utils')
const PinManager = require('./pin-manager')
const { PinTypes } = PinManager
const withTimeoutOption = require('ipfs-core-utils/src/with-timeout-option')
const normaliseInput = require('ipfs-core-utils/src/pins/normalise-input')

/**
 * @param {import('.').Context} context
 * @param {import('ipfs-core-types/src/pin').PinSource} source
 * @param {import('ipfs-core-types/src/pin').AddAllOptions} [options]
 * @returns {AsyncIterable<import('cids')>}
 */
async function * addAll (context, source, options = {}) {
  // When adding a file, we take a lock that gets released after pinning
  // is complete, so don't take a second lock here
  if (options.lock) {
    const release = await context.gcLock.readLock()
    try {
      yield * pinAdd(context, source)
    } finally {
      release()
    }
  } else {
    yield * pinAdd(context, source)
  }
}

/**
 * @param {import('.').Context} context
 * @param {import('ipfs-core-types/src/pin').PinSource} source
 */
async function * pinAdd ({ pinManager, dagReader }, source) {
  for await (const { path, recursive, metadata } of normaliseInput(source)) {
    const cid = await resolvePath(dagReader, path)

    // verify that each hash can be pinned
    const { reason } = await pinManager.isPinnedWithType(cid, [PinTypes.recursive, PinTypes.direct])

    if (reason === 'recursive' && !recursive) {
      // only disallow trying to override recursive pins
      throw new Error(`${cid} already pinned recursively`)
    }

    if (recursive) {
      await pinManager.pinRecursively(cid, { metadata })
    } else {
      await pinManager.pinDirectly(cid, { metadata })
    }

    yield cid
  }
}

module.exports = withTimeoutOption(addAll)
