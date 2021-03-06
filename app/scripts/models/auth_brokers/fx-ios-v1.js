/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

/**
 * The auth broker to coordinate authenticating for Sync when
 * embedded in the Firefox for iOS 1.0 ... < 2.0.
 */

define(function (require, exports, module) {
  'use strict';

  const _ = require('underscore');
  const $ = require('jquery');
  const Constants = require('lib/constants');
  const FxDesktopV1AuthenticationBroker = require('models/auth_brokers/fx-desktop-v1');
  const NullBehavior = require('views/behaviors/null');
  const p = require('lib/promise');
  const UserAgent = require('lib/user-agent');

  const proto = FxDesktopV1AuthenticationBroker.prototype;

  const FxiOSV1AuthenticationBroker = FxDesktopV1AuthenticationBroker.extend({
    defaultCapabilities: _.extend({}, proto.defaultCapabilities, {
      chooseWhatToSyncCheckbox: false,
      convertExternalLinksToText: true,
      immediateUnverifiedLogin: false
    }),

    initialize (options = {}) {
      proto.initialize.call(this, options);

      if (this._supportsImmediateUnverifiedLogin()) {
        this.setCapability('immediateUnverifiedLogin', true);

        // Fx for iOS allows the user to see the "confirm your email" screen,
        // but never takes it away after the user verifies. Allow the poll
        // so that the user sees the "Signup complete!" screen after they
        // verify their email.
        this.setBehavior(
          'beforeSignUpConfirmationPoll', new NullBehavior());
      }
    },

    /**
     * Get the user-agent string. For functional testing
     * purposes, first attempts to fetch a UA string from the
     * `forceUA` query parameter, if that is not found, use
     * the browser's.
     *
     * @returns {String}
     * @private
     */
    _getUserAgentString () {
      return this.getSearchParam('forceUA') || this.window.navigator.userAgent;
    },

    /**
     * Check if the browser supports immediate login
     * for unverified accounts.
     *
     * @returns {Boolean}
     * @private
     */
    _supportsImmediateUnverifiedLogin () {
      const userAgent = new UserAgent(this._getUserAgentString());
      const version = userAgent.parseVersion();
      return version.major > 6 ||
            (version.major === 6 && version.minor >= 1);
    },

    /**
     * Notify the relier of login. This contains a bit of a hack.
     * Fx for iOS < 6.1 takes over the UI as soon as it receives a `login`
     * message. For verified accounts, this is fine because the user
     * is signed in and Sync starts immediately. For unverified accounts,
     * this causes problems because users don't have enough time to
     * see the "Go verify your account" screen and often drop off.
     *
     * To give unverified users a bit of time to see the "go verify
     * your account" screen, a slight delay is introduced before
     * sending the `login` message. If the user blurs the Fx for iOS
     * window during this delay, for example if the user goes to check
     * their email, then the `login` message is sent immediately so
     * the browser can update its UI.
     *
     * If the account is verified, send the `login` message right away.
     *
     * This problem goes away w/ Fx for iOS 6.1.
     *
     * https://bugzilla.mozilla.org/show_bug.cgi?id=1335491
     *
     * @param {Object} account
     * @returns {Promise}
     * @private
     */
    _notifyRelierOfLogin (account) {
      if (account.get('verified') ||
          this.getCapability('immediateUnverifiedLogin')) {
        // For verified accounts, always send the `login` message right away -
        // no screen transition occurs in this case so it's safe to let
        // the browser take over the UI.
        // If the browser supports `immediateUnverifiedLogin`,
        // also send right away. We know it'll do the right thing.
        return proto._notifyRelierOfLogin.call(this, account);
      }

      const deferred = p.defer();
      const resolve = () => deferred.resolve();

      const win = this.window;
      const $win = $(win);

      const timeout = win.setTimeout(resolve, Constants.IOS_V1_LOGIN_MESSAGE_DELAY_MS);
      $win.on('blur', resolve);

      return deferred.promise
        .then(() => proto._notifyRelierOfLogin.call(this, account))
        .then((response) => {
          win.clearTimeout(timeout);
          $win.off('blur', resolve);
          return response;
        });
    }
  });

  module.exports = FxiOSV1AuthenticationBroker;
});
