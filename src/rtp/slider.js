/*

  Copyright (c) Marcel Greter 2010/2012 - rtp.ch - RTP jQuery Slider
  This is free software; you can redistribute it and/or modify it under the terms
  of the [GNU General Public License](http://www.gnu.org/licenses/gpl-3.0.txt),
  either version 3 of the License, or (at your option) any later version.

*/

// START anonymous scope
(function(jQuery)
{

	'use strict';


	// declare our namespace
	if (!window.RTP) window.RTP = {};


	/* @@@@@@@@@@ CONSTRUCTOR @@@@@@@@@@ */
	RTP.Slider = function (el, options)
	{

		// create closure for
		// resize event handler
		var slider = this;

		// only init once
		if (slider.inited) { return; }
		else { slider.inited = true; }

		// create new config by extending with data array
		// data options take priority over instance options
		var conf = jQuery.extend(true, {}, options, jQuery(el).data());

		// connect parent layout widget
		slider.layout = { parent: options.parent };

		// @@@ private fn: extend @@@
		function defaults (config)
		{

			// create new config
			slider.conf = {};

			// add more (default) configuration options (deep extend)
			// preserves the already set configuration (just set default)
			return conf = jQuery.extend(true, slider.conf, config, conf);

		}
		// @@@ EO private fn: extend @@@

		// add defaults
		defaults({

			// the panel alignment to the position
			align: 'center',

			// inherits from align
			alignPanelDim: false,
			alignPanelOpp: false,
			alignViewport: false,

			// vertical sliding is also supported
			vertical: false,

			// set float parameter for panels
			// will not be set if vertical is true
			setFloat: true,

			// enable endless carousel
			carousel: false,

			// the first slide to load after init
			// this can also be a callback function
			slideFirst: 0,

			// how many panels should be visible
			// mainly used for the layout sizers, but
			// also defines how many panels are cloned
			panelsVisible: 1,

			// frames per second to draw
			// defer all position updates
			// leave the UA some idle loops
			fps: 25,
			// synchronise with monitor
			// draw as soon as requested
			vsync: false,

			// we often want to have margin between
			// the slides, but still want to fill the
			// while viewport. Computation of this is
			// tricky, so I've added this static option.
			margin: 0,

			// how many panels should be cloned
			// if this is set to true, we will use
			// the panelsVisible option for this
			// set to false to disable cloning
			clonePanels: true,

			// in which direction should we clone
			// adds cloned panels before or after
			cloneAfter: true,
			cloneBefore: true,

			// define which axis of the panel is fixed
			// the other axis can be fluid by some ratio
			// this is possible by having an image inside
			// which spans to 100% in both directions
			// may gets overwritten by panelsByViewport sizer
			panelFixedAxis: conf.vertical ? 'opp' : 'dim',

			// initialize some structures
			// they can be used by plugins

			// localized texts
			text: {},

			// templates fragments
			tmpl:
			{
				wrapper : '<div/>',
				viewport : '<div/>',
				container : '<div/>'
			},

			// classes to assign
			klass:
			{
				next: 'rtp-slider-next',
				current: 'rtp-slider-current',
				previous: 'rtp-slider-previous',
				vertical: 'rtp-slider-vertical',
				horizontal: 'rtp-slider-horizontal',
				panel : 'rtp-slider-panel',
				wrapper: 'rtp-slider-wrapper',
				viewport : 'rtp-slider-viewport',
				container : 'rtp-slider-container'
			}

		});
		// EO extend config

		// execute all config hooks
		// this will add more defaults
		slider.trigger('config', defaults);

		// assign shortcuts to access nested config
		jQuery(['text', 'tmpl', 'klass', 'selector'])
		.each(function() { slider[this] = conf[this]; })

		// optimize for compiler
		var tmpl = slider.tmpl,
		    klass = slider.klass,
		    selector = slider.selector;

		// assertion for some options
		if (isNaN(conf.align))
		{ conf.align = 0.5; }
		if (isNaN(conf.panelsVisible))
		{ conf.panelsVisible = 1.0; }

		// current element is used as our container
		var container = slider.container = jQuery(el);

		// get all intial panels (slides) once at startup (after config)
		var slides = slider.slides = container.find('>.' + klass.panel);

		// assertion if no slides found
		if (slides.length == 0) return;

		// don't init further if there is only a single slide
		if (conf.dontInitSingle && slides.length < 2) return;

		// put viewport around container
		var viewport = slider.viewport = container
			.wrapAll(tmpl.viewport).parent();

		// put wrapper around viewport
		var wrapper = slider.wrapper = viewport
			.wrapAll(tmpl.wrapper).parent();

		// move all attributes from container to viewport
		var attrs = el.attributes, idx = attrs.length;

		// process all attributes
		while (idx--)
		{
			// copy the attribute from container to viewport
			viewport.attr(attrs[idx].name, attrs[idx].value);
			// remove the attribute on the container
			container.removeAttr(attrs[idx].name);
		}

		// force the container to have no margin and padding
		container.css({ 'margin' : '0', 'padding' : '0' });

		// add default class to all elements
		wrapper.addClass(klass.wrapper);
		viewport.addClass(klass.viewport);
		container.addClass(klass.container);

		// min and max index for slides
		slider.smin = slider.smax = 0;

		// mark wrapper indicating vertical/horizontal mode
		if (conf.vertical && klass.vertical)
		{ slider.wrapper.addClass(klass.vertical); }
		if (!conf.vertical && klass.horizontal)
		{ slider.wrapper.addClass(klass.horizontal); }

		// first slide to load may be a function
		slider.position = jQuery.isFunction(conf.slideFirst)
			? conf.slideFirst.call(slider)
			: conf.slideFirst || 0;

		// @@@ private fn: resolve_align @@@
		// this can be a number between -INF and +INF
		// or you can use "left", "center" or "right"
		function resolve_align (key, preset)
		{

			// get configured option
			var align = conf[key];

			// check if align matches any of our strings
			if (new RegExp(/^[lt]/i).test(align)) align = 0.0;
			if (new RegExp(/^[cm]/i).test(align)) align = 0.5;
			if (new RegExp(/^[rb]/i).test(align)) align = 1.0;

			// now check if it's valid or use given preset
			if (isNaN(parseInt(align, 10))) align = preset;
			// maybe there was no preset given, check again
			if (isNaN(parseInt(align, 10))) align = 0.5;

			// assign and return the number
			return conf[key] = align;

		}
		// EO @@@ private fn: resolve_align @@@

		// first resolve the shared value to inherit from
		var preset = resolve_align('align', 0.5);
		// then resolve the specific align options
		resolve_align('alignPanelDim', preset);
		resolve_align('alignPanelOpp', preset);
		resolve_align('alignViewport', preset);

		// fix the panel size from initial read
		var i = this.slides.length; while (i--)
		{

			// get jQuery object of this slide
			var slide = jQuery(this.slides[i]);

			// fix the size of the panel
			// TODO: make axis configurable
			if (conf.panelFixedAxis == 'dim')
			{ slide.outerWidth(slide.width()); }
			else if (conf.panelFixedAxis == 'opp')
			{ slide.outerHeight(slide.height()); }

		}
		// EO each slide

		// init array always
		// avoid checks in code
		slider.cloned = jQuery();

		// create cloned panels
		if (conf.carousel && slides.length)
		{

			// get variables (resolve afterwards)
			var cloneAfter = conf.cloneAfter,
			    cloneBefore = conf.cloneBefore,
			    clonePanels = conf.clonePanels,

			// Clone as many panels needed to fill the viewport.
			// If sizer is false you can use this config option
			// to adjust how many panels you want to have cloned
			// In this mode the viewport might be much wider than
			// all panels inside. Todo: Maybe support this better.
			clonePanels = clonePanels === true ? Math.ceil(conf.panelsVisible) :
			              clonePanels === false ? 0 : parseInt(clonePanels + 0.5);

			// distribute cloned panels after (right/bottom)
			cloneAfter = cloneAfter === true ? Math.ceil(clonePanels * (1 - conf.alignViewport)) :
			             cloneAfter === false ? 0 : isNaN(cloneAfter) ? 0 : cloneAfter;

			// distribute cloned panels before (left/top)
			cloneBefore = cloneBefore === true ? Math.ceil(clonePanels * (0 + conf.alignViewport)) :
			              cloneBefore === false ? 0 : isNaN(cloneBefore) ? 0 : cloneBefore;

			// accumulate all cloned panels
			// we may clone each slide more than once
			var after = jQuery([]), before = jQuery([]);

			// I will clone as many as you wish
			while (cloneBefore > slides.length)
			{
				// remove a full set of slides
				cloneBefore -= slides.length;
				// clone and add another full set
				jQuery.merge(before, slides.clone());
			}

			// clone panels before
			if (cloneBefore > 0)
			{
				// clone panels from end to extend the container
				before = jQuery.merge(slides.slice(- cloneBefore).clone(), before);
			}

			// I will clone as many as you wish
			while (cloneAfter > slides.length)
			{
				// remove a full set of slides
				cloneAfter -= slides.length;
				// clone and add another full set
				jQuery.merge(after, slides.clone());
			}

			// clone panels after
			if (cloneAfter > 0)
			{
				// clone panels from begining to extend the container
				jQuery.merge(after, slides.slice(0, cloneAfter).clone());
			}

			// append the cloned panels to the container and set class
			after.appendTo(slider.container).addClass('cloned');
			before.prependTo(slider.container).addClass('cloned');

			// increase min and max slide index
			slider.smax += after.length;
			slider.smax += before.length;
			slider.smin += before.length;

			// merge all cloned panels
			jQuery.merge(slider.cloned, before);
			jQuery.merge(slider.cloned, after)

			// store the cloned panels
			slider.before = before;
			slider.after = after;

		}
		// EO if conf.carousel

		// execute all init hooks
		slider.trigger('init');

		// lookup panels - equals slides if carousel == false
		slider.panels = container.find('>.' + klass.panel);

		// to which side should we float the panels / container
		// we normally always need to float the panels, also
		// for vertical stacking (just clear the float again)
		var floating = conf.offsetReverse ? 'right' : 'left';

		// for experimental carousel 3d module
		var overflow = conf.carousel3d ? 'visible' : 'hidden';

		// setup css for every panel
		var css = slider.conf.setFloat ?
			{ 'float' : floating } : {};

		// set some css to fix some issues
		// if you do not want this you have
		// to remove these styles on ready event
		slider.panels.css(css)
		// add viewport to collection
		.add(slider.viewport)
		// set on viewport and panels
		.css({ 'overflow' : overflow })
		// add container to collection
		.add(slider.container)
		// set on container, viewport and panels
		.css({ 'position' : 'relative', 'zoom' : 1 })

		// setup floats for the container
		if (!conf.vertical)
		{
			// get the tagname for panels
			var tag = slider.panels[0].tagName;
			// define html code for float clearer
			var clearer_div = jQuery('<DIV/>');
			var clearer_tag = jQuery('<' + tag + '/>');
			// define the css styles for the clearer tags
			var clearer_styles = { width: 0, height: 0, clear: 'both' };
			// we either float the container right or left
			slider.container.css('float', floating)
				// insert a float clearing div after the container
				.append(clearer_tag.css(clearer_styles))
				.after(clearer_div.css(clearer_styles));
		}

		// trigger loading hook
		slider.trigger('loading');

		// defer until all images are loaded
		// otherwise we will not get valid info
		// about resource dimensions like images
		jQuery('IMG', viewport)
			// wait loading images
			.imagesLoaded()
			// execute when ready
			.done(function()
			{

				// mark resource loaded
				slider.resReady = true;
				// trigger ready hook
				slider.trigger('ready');

			});

			// this fixes at least a bug in firefox 42: when we have a panel with
			// an image, we sometime read the same height as the width, even if
			// aspect ration is not 1:1. When I log `clientHeight` is see 791, but
			// when I also log and inspect the dom object, I see something different.
			jQuery(window).bind('load', function() { slider.trigger('ready'); })

	};
	/* @@@@@@@@@@ CONSTRUCTOR @@@@@@@@@@ */


	/* @@@@@@@@@@ RTP CLASS @@@@@@@@@@ */
	(function (prototype, jQuery)
	{


		// @@@ method: panel2panel @@@
		prototype.panel2panel = function(panel)
		{
			// adjust for carousel
			if (this.conf.carousel)
			{
				// get number of slides
				var count = this.slides.length;
				// protect from endless loop
				if (count <= 0) return 0;
				// adjust panels into the valid range
				while (panel > this.smax) panel -= count;
				while (panel < this.smin) panel += count;
			}
			else
			{
				// adjust panels to outer ranges
				if (panel > this.smax) panel = this.smax;
				if (panel < this.smin) panel = this.smin;
			}
			// return the in range panel
			return panel;
		}
		// @@@ EO method: panel2panel @@@


		// @@@ method: slide2panel @@@
		prototype.slide2panel = function(slide)
		{
			return this.panel2panel(slide + this.smin);
		}
		// @@@ EO method: slide2panel @@@


		// @@@ method: panel2slide @@@
		prototype.panel2slide = function (panel)
		{
			return this.panel2panel(panel) - this.smin;
		}
		// @@@ EO method: panel2slide @@@


		// @@@ method: panel2slide @@@
		prototype.slide2slide = function (slide)
		{
			return this.panel2slide(this.slide2panel(slide));
		}
		// @@@ EO method: panel2slide @@@


		// @@@ method: update @@@
		prototype.update = function (option)
		{
			// trigger updating event
			// use to adjust stuff if needed
			// ie. used by nav dots to adjust
			this.trigger('updating', option);
			// extend our config with new options
			jQuery.extend(true, this.conf, option);
			// trigger position change event
			console.log('new config');
			this.trigger('layout');
			// call global layout
			OCBNET.Layout(true);
		}
		// @@@ EO method: update @@@


	// EO extend class prototype
	})(RTP.Slider.prototype, jQuery);
	/* @@@@@@@@@@ RTP CLASS @@@@@@@@@@ */


	/* @@@@@@@@@@ JQUERY CONNECTOR @@@@@@@@@@ */
	jQuery.fn.rtpSlider = function(conf)
	{
		return this.each(function(){
			// check if already initialized
			if (typeof jQuery(this).data('rtp-slider') == 'undefined')
			{ jQuery(this).data('rtp-slider', new RTP.Slider(this, conf)); }
			// else { throw('you tried to init rtp-slider twice') }
		});
	}
	/* @@@@@@@@@@ JQUERY CONNECTOR @@@@@@@@@@ */


// END anonymous scope
})(jQuery);