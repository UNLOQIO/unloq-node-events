'use strict';
/**
 * Utilities
 */

const util = {};


util.error = function error(code, message) {
  let e = new Error(message);
  e.code = code;
  return e;
};

util.parseError = function parseError(e) {
  let err;
  if (typeof e === 'object' && e) {
    if (e instanceof Error) {
      err = e;
    } else {
      err = new Error(e.message || 'Failed to complete fetch request.');
    }
  } else {
    e = {};
    err = new Error(e.message || 'Failed to complete fetch request');
  }
  Object.keys(e).forEach((key) => {
    err[key] = e[key];
  });
  if (!err.code) err.code = 'SERVER_ERROR';
  if (!err.status) err.status = 500;
  return err;
};

util.getOptions = function getOptions(opt, DEFAULT_GATEWAY) {
  if (typeof opt !== 'object' || !opt) opt = {};
  if (typeof opt.gateway !== 'string' || !opt.gateway) {
    opt.gateway = DEFAULT_GATEWAY;
  }
  if (typeof opt.key !== 'string' || !opt.key) {
    opt.key = process.env.UNLOQ_KEY;
  }
  if (!opt.key) {
    throw new Error('unloq-events: requires UNLOQ API key.');
  }

  if (typeof opt.options !== 'object' || !opt.options) opt.options = {};
  opt.options.path = '/ws';
  opt.options.reconnectionDelay = 2000;
  opt.options.randomizationFactor = 0;
  opt.options.timeout = 2000;
  opt.options.extraHeaders = {
    'user-agent': 'unloq-events',
    Authorization: `Bearer ${opt.key}`
  };
  return opt;
};

module.exports = util;
