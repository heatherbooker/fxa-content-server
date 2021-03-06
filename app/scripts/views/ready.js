/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

/**
 * Prints a message to the user that says
 * "All ready! You can go visit {{ service }}"
 */

define(function (require, exports, module) {
  'use strict';

  const Cocktail = require('cocktail');
  const Constants = require('lib/constants');
  const ExperimentMixin = require('views/mixins/experiment-mixin');
  const FormView = require('views/form');
  const MarketingMixin = require('views/mixins/marketing-mixin');
  const PulseGraphicMixin = require('views/mixins/pulse-graphic-mixin');
  const ServiceMixin = require('views/mixins/service-mixin');
  const Template = require('stache!templates/ready');
  const VerificationReasonMixin = require('views/mixins/verification-reason-mixin');

  const t = msg => msg;

  /*eslint-disable camelcase*/

  /**
   * Some template strings are fetched from JS to keep
   * the template marginally cleaner and easier to read.
   */
  const TEMPLATE_INFO = {
    FORCE_AUTH: {
      headerId: 'fxa-force-auth-complete-header',
      headerTitle: t('Welcome back'),
      readyToSyncText: t('Firefox Sync will resume momentarily'),
    },
    PASSWORD_RESET: {
      headerId: 'fxa-reset-password-complete-header',
      headerTitle: t('Password reset'),
      readyToSyncText: t('Complete set-up by entering the new password on your other Firefox devices.')
    },
    // signin_confirmed and signin_verified are only shown to Sync for now.
    SIGN_IN: {
      headerId: 'fxa-sign-in-complete-header',
      headerTitle: t('Sign-in confirmed'),
      readyToSyncText: t('You are now ready to use %(serviceName)s')
    },
    SIGN_UP: {
      headerId: 'fxa-sign-up-complete-header',
      headerTitle: t('Account verified'),
      readyToSyncText: t('You are now ready to use %(serviceName)s')
    }
  };

  /*eslint-enable camelcase*/

  const View = FormView.extend({
    template: Template,
    className: 'ready',

    initialize (options = {}) {
      this._templateInfo = TEMPLATE_INFO[this.keyOfVerificationReason(options.type)];
    },

    context () {
      return {
        headerId: this._getHeaderId(),
        headerTitle: this._getHeaderTitle(),
        isSync: this.relier.isSync(),
        readyToSyncText: this._getReadyToSyncText(),
        redirectUri: this.relier.get('redirectUri'),
        service: this.relier.get('service'),
        serviceName: this.relier.get('serviceName'),
        shouldShowProceedButton: this._shouldShowProceedButton()
      };
    },

    _getHeaderId () {
      return this._templateInfo.headerId;
    },

    _getHeaderTitle () {
      var title = this._templateInfo.headerTitle;
      return this.translateInTemplate(title);
    },

    _getReadyToSyncText () {
      var readyToSyncText = this._templateInfo.readyToSyncText;
      return this.translateInTemplate(readyToSyncText);
    },

    _submitForProceed () {
      return this.metrics.flush().then(() => {
        this.window.location.href = this.relier.get('redirectUri');
      });
    },

    submit () {
      if (this._shouldShowProceedButton()) {
        return this._submitForProceed();
      }
    },

    /**
     * Determines if the view should show the "Proceed" button in the template.
     * The button links to the redirect_uri of the relier with no extra
     * OAuth information.
     *
     * @returns {Boolean}
     * @private
     */
    _shouldShowProceedButton () {
      var redirectUri = this.relier.get('redirectUri');
      var verificationRedirect = this.relier.get('verificationRedirect');

      return !! (this.isSignUp() &&
                 redirectUri &&
                 verificationRedirect === Constants.VERIFICATION_REDIRECT_ALWAYS);
    }
  });

  Cocktail.mixin(
    View,
    ExperimentMixin,
    MarketingMixin({ marketingId: Constants.MARKETING_ID_SPRING_2015 }),
    PulseGraphicMixin,
    ServiceMixin,
    VerificationReasonMixin
  );

  module.exports = View;
});
