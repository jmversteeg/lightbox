'use strict';

const $ = window.jQuery ? window.jQuery : require('jquery');

const _            = require('lodash');
const Mousetrap    = require('mousetrap');
const EventEmitter = require('events').EventEmitter;
const transit      = require('jquery.transit');

// Fix compatibility with global $ and modular transit
if (!$.fn.transition)
  $.fn.transition = transit.fn.transition;

var Lightbox = function (options) {

  options = options || {};

  this.fd           = options.fd || 300;
  this.base_url     = options.base_url || '';
  this.localContent = options.localContent || {};

  this.isDesktop     = $(window).width() > 767;
  this.isVisible     = false;
  this.lastScrollpos = 0;
  this.events        = new EventEmitter();

  this.inline_transforms = require('./inline-transforms');
};

Lightbox.prototype = {

  /**
   * Applies the provided transforms
   *
   * @param {Object} transforms
   */
  applyTransforms: function (transforms) {
    $.each(transforms, function (key, value) {
      if (this.inline_transforms.hasOwnProperty(key))
        this.inline_transforms[key](this, value);
    }.bind(this));
  },

  /**
   * Performs the transformations as specified in the html content
   *
   * @param {string} html
   */
  do_inline_transforms: function (html) {
    var match;
    var patt       = /<!--\s*([a-z\-]+):\s*(.*?)\s*-->/mg;
    var transforms = {};
    while ((match = patt.exec(html)) !== null)
      transforms[match[1]] = match[2];
    this.applyTransforms(transforms);
  },

  /**
   * Desktop-specific function to be executed when new content is to be shown
   */
  show_content_desktop: function () {
    var $window   = $(window);
    var marginTop = -this.$inner.outerHeight() / 2;
    var top       = Math.max($window.scrollTop() + $window.height() / 2, -marginTop + 40);
    this.$inner.stop().css({
      'margin-top':  marginTop,
      'margin-left': -this.$inner.outerWidth() / 2,
      'top':         top,
      display:       'block',
      opacity:       0,
      transform:     'scale(0.6) translate(0, 40px)'
    }).transition({
      opacity: 1,
      scale:   1,
      y:       0
    }, this.fd);
  },

  /**
   * Mobile-specific function to be executed when new content is to be shown
   */
  show_content_mobile: function () {
    this.lastScrollpos = $(window).scrollTop();
    this.$page.hide();
    this.$inner.show();
  },

  /**
   * Show given HTML content in the lightbox
   *
   * @param {string|jQuery} content
   * @private
   */
  _show_content: function (content) {
    this.$content.empty().append(content);
    this.$loader.hide();
    this.do_inline_transforms(content.html ? content.html() : content);
    if (this.isDesktop)
      this.show_content_desktop();
    else
      this.show_content_mobile();
    this.fixScroll();
    this.isVisible = true;
    $('body').addClass("lightbox-showing");
    var lb = this;

    Mousetrap.bind(['esc'], function (e) {
      if (e.preventDefault)
        e.preventDefault();
      lb.close();
      Mousetrap.unbind(['esc']);
    });

    this.events.emit('content_shown');
  },

  /**
   * Fix page scroll position. Experimental.
   */
  fixScroll: function () {
    if (this.isVisible && this.isDesktop) {
      var st    = $(window).scrollTop();
      var lt    = this.$content.offset().top;
      var lb    = lt + this.$content.height();
      var minSt = Math.max(0, Math.min(lt - 50, lb + 50 - $(window).height()));
      var maxSt = Math.max(minSt + 10, lb + 50 - $(window).height(), lt - 50);
      if (st < minSt)
        $(window).scrollTop(minSt);
      else if (st > maxSt)
        $(window).scrollTop(maxSt);
    }
  },

  /**
   * Load the lightbox content based on the href or lightbox content identifier
   *
   * @param {string} target
   * @param {Object} [ajaxOptions] Optional object containing additional objects to be passed to $.ajax
   * @param {string} [loaderText] If set, the text will be displayed on screen while the content is being loaded
   */
  load_content: function (target, ajaxOptions, loaderText) {
    if (loaderText) {
      this.$loader.text(loaderText).show();
    } else this.$loader.hide();
    this.$over.stop().fadeIn(this.fd);
    var matches = /@(.*)/.exec(target);
    if (matches !== null && this.localContent.hasOwnProperty(matches[1]))
      this._show_content(this.localContent[matches[1]]);
    else
      $.ajax($.extend(true, {}, {
        url:      this.base_url + target,
        headers:  {
          'is-lightbox-content': 'true'
        },
        dataType: 'html',
        success:  this._show_content.bind(this)
      }, ajaxOptions));
  },

  /**
   * Show given HTML content or jQuery node in the lightbox
   *
   * @param {string|jQuery} content
   */
  show_content: function (content) {
    this.$over.stop().fadeIn(this.fd);
    this._show_content(content);
  },

  forceHideOverlays () {
    // there was some trouble with shit staying visible so we fixed it.
    this.$over.hide();
    this.$loader.hide();
  },

  /**
   * Close the lightbox
   */
  close: function () {
    this.$inner.fadeOut();
    this.$over.fadeOut(this.fd, () => setTimeout(() => this.forceHideOverlays(), 10));
    $('body').removeClass("this-showing");
    this.isVisible = false;
    if (!this.isDesktop) {
      this.$page.show();
      $(window).scrollTop(this.lastScrollpos);
    }
  },

  /**
   * Hide the lightbox, without removing the "overlay". Use this in case the page is about to navigate away
   */
  closePending: function () {
    this.$inner.fadeOut();
  }
};

module.exports = Lightbox;
