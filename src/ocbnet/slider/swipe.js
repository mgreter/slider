/*

  Copyright (c) Marcel Greter 2012 - ocbnet.ch - RTP jQuery Slider Core Swipe Plugin
  This is free software; you can redistribute it and/or modify it under the terms
  of the [GNU General Public License](http://www.gnu.org/licenses/gpl-3.0.txt),
  either version 3 of the License, or (at your option) any later version.

*/

// extend class prototype
(function (prototype, jQuery)
{

	'use strict';


	/*
	  This function is used to calculate the speed when
	  the user releases the mouse or swipe gesture.
	  We record the positions of the points and the timestamp,
	  then this function calculates the average speed.
	  http://en.wikipedia.org/wiki/Least_squares
	  http://pcbheaven.com/wikipages/The_Least_Squares_Fitting/
	*/
	var LeastSquaresFitting = function (points, scale)
	{

		// no result if less than 2 points given
		if (points.length < 2) return [0, 0];

		// get a timestamp from current time
		var timestamp = points[0][2];

		// declare variables to calculate the sums
		var sum_x = 0, sum_y = 0, sum_xy = 0, sum_xx = 0;

		for (var i = 0, l = points.length; i < l; i++)
		{

			var y = points[i][0] / scale,
			    x = points[i][2] - timestamp;

			sum_x += x; sum_xx += x * x;
			sum_y += y; sum_xy += x * y;

		}

		var m = (l * sum_xy - sum_x * sum_y) / (l * sum_xx - sum_x * sum_x);
		var n = (sum_y * sum_xx - sum_x * sum_xy) / (l * sum_xx - sum_x * sum_x);

		if (isNaN(m)) console.log(sum_x, sum_xx, sum_y, sum_xy, points);

		return [m, n];

	};


	// @@@ plugin: config @@@
	prototype.plugin('config', function (extend)
	{

		// status variable
		this.swipe = false;

		// add defaults
		extend({

			// pixel offset before fixing direction
			// from then on we either scroll or swipe
			swipeThreshold : 5

		});

	});
	// @@@ EO plugin: config @@@


	// @@@ plugin: swipeStart @@@
	prototype.plugin('swipeStart', function (x, y, data)
	{

		// pause autoslider if it's active at the moment
		if (this.autoSlidePause) this.autoSlidePause();

		// assert that, when swiping is given, animation lock is set
		// if (this.locked && !this.animation) alert('invalid status');

		// lock the animations
		this.animation = true;

		// store last moves
		data.swipeMoves = [];
		// store swiped position
		data.swipePosOff = 0;
		// init direction status variables
		data.swipeDrag = data.swipeScroll = false;
		// store the start positions for this swipe
		data.swipeStartDrag = data.swipeX = x;
		data.swipeStartScroll = data.swipeY = y;

		data.dragOff = 0;

		// remember start position
		data.swipeStartPosition = this.position;

		// get viewport offset
		var vp_off = this.getViewportOffset();

		var offset = this.ct_off + x - vp_off.x;

		data.vp_off = vp_off.x;

		// get the position where the drag has been started / initiated (point of interest)
		data.swipeStartDragPos = this.getPositionByOffset(offset);
		data.swipeStartPositionOff = this.getOffsetByPosition(this.position) - offset;

		// we are now going to swipe
		this.locked = true;

		// abort all other animations
		this.trigger('abortAnimation');

	});
	// @@@ EO plugin: swipeStart @@@


	// @@@ plugin: swipeDraw @@@
	prototype.plugin('swipeDraw', function (data)
	{

		// get the real offset for the given position (might be "out of bound")
		var offset = this.getOffsetByPosition(this.position, true) + data.dragOff;

		// calculate real position by real offset
		var position = this.getPositionByOffset(offset, true);

		// keep track of real position dragging
		data.swipePosOff += position - this.position;

		// now set to new position
		// position will be normalized
		this.setPosition(position);

		// reset pixel offset
		data.dragOff = 0;

	})
	// @@@ EO plugin: swipeDraw @@@


	// @@@ plugin: swipeMove @@@
	prototype.plugin('swipeMove', function (x, y, data, dx, dy)
	{

		this.swiping = true;

		// get from data into local variable
		// usefull for performance and minimizing
		var moves = data.swipeMoves;

		// store current swipe position
		data.swipeX = x; data.swipeY = y;

		data.dragOff += dx;

		// try to determine the prominent axis for this swipe movement
		if (data.swipeDrag == false && data.swipeScroll == false)
		{
			// threshold to determine/fix direction
			var threshold = this.conf.swipeThreshold;
			// check if there was an initial minimum amount of movement in some direction
			if (Math.abs(data.swipeStartDrag - x) > threshold) { data.swipeDrag = true; }
			else if (Math.abs(data.swipeStartScroll - y) > threshold) { data.swipeScroll = true; }
		}

		// check if this move is going into another direction then before
		// ToDo: Could also add a threshold that a small back move will be tolerated
		var length = moves.length; if (length > 2)
		{
			if (moves[length-2][0] < moves[length-1][0] && moves[length-1][0] > x) { moves.length = 0; }
			else if (moves[length-2][0] > moves[length-1][0] && moves[length-1][0] < x) { moves.length = 0; }
		}

		// do not record to many steps (memory usage)
		if (moves.length > 20) moves.shift();

		// push the coordinates with timestamp to our data array
		moves.push([x, y, (new Date()).getTime()]);

		// abort this event if not dragging
		if (!data.swipeDrag) return true;

		this.trigger('swipeDraw', data);

		// return false if dragging
		return ! data.swipeDrag;

	});
	// @@@ EO plugin: swipeMove @@@


	// @@@ private fn: snap @@@
	function snap(val, grid, base)
	{
		// assertion for optional values
		grid = grid || 1; base = base || 0;
		// snap the value to the grid, regarding to its base
		return grid * Math.round((val - base) / grid) + base;
	}
	// @@@ EO private fn: snap @@@

	// @@@ private fn: getFinalOffset @@@
	function getFinalOffset (start, off, inertia)
	{

		// get number of panels visible at once
		var vis = Math.floor(this.conf.panelsVisible);

		// config value if we are grouping panels
		// this means we treat them as one panel
		if (!this.conf.groupPanels) vis = 1;

		// create the main position anchor
		// all motions are aligned to this
		var anchor = snap(start, 1);

		// get the end position without any snapping
		// this is where the swipe plus inertia would go
		var real_position = start + off + inertia;

		// snap the final position to the anchor by a grid
		// defined by the number of visible panels. This may
		// should only be done if we are grouping panels!
		var final_position = snap(real_position, vis, anchor);

		// calculate offset from current position
		// start and off are already in that value
		var offset = final_position - off - start;

		// return result
		return offset;

	}
	// @@@ EO private fn: getFinalOffset @@@


	// @@@ plugin: swipeStop @@@
	prototype.plugin('swipeStop', function (x, y, data)
	{

		// abort all other animations
		this.trigger('abortAnimation');

		// get from data into local variable
		// usefull for performance and minimizing
		var moves = data.swipeMoves;

		// first call swipe move to do some work
		this.trigger('swipeMove', x, y, data, 0, 0);

		// clear swipe draw timer
		this.undefer('swipeDraw');

		// get a timestamp from current time
		var timestamp = (new Date()).getTime();

		// get the limiting timestamp for moves
		var limit = timestamp - 500;

		// get number of panels visible at once
		var vis = Math.floor(this.conf.panelsVisible);

		// remove all moves that happend before our limit
		while (moves.length && moves[0][2] < limit) moves.shift();

		// get fitted linear function parameters
		var least = LeastSquaresFitting(moves, this.vp_x / 2);

		// linear fn -> y = m*x + n
		var m = least[0] * this.vp_x / 2, n = least[1];

		// get absolute speed
		var speed = Math.abs(m);

		// check for valid movement
		if (x == 0 && y == 0) speed = 0;

		// direction of the movement
		var direction = m < 0 ? - 1 : 1;

		// get the inertia of the swipe movement (maybe improve this more)
		var inertia = Math.pow(speed * 0.5 * vis, 0.5) * - direction;

		// call private function to calculate the actual real offset for final animation
		var offset = getFinalOffset.call(this, data.swipeStartPosition, data.swipePosOff, inertia)

		// do corrections when snapping is off (see nested example)
		offset = Math.round(this.position + offset) - this.position;

		// unlock slider
		this.locked = false;

		// abort all other animations
		this.trigger('abortAnimation');

		// first call swipe move to do some work
		this.trigger('swipeFinish', x, y, data);

		var duration = 0, easing = 'linear',
		    delta = Math.abs(offset);

		if (delta > 0.5)
		{
			easing = speed < 0.375 ? 'easeOutBounce' : 'easeOutExpo';
			duration = Math.max(Math.min(100 / Math.pow(1/speed, 1.5), 9000), 1200);
		}
		else if (delta > 0)
		{
			easing = speed < 0.375 ? 'easeOutBounce' : 'easeOutExpo';
			duration = Math.max(Math.min(100 / Math.pow(1/speed, 1.5), 2000), 600);
		}

		// account for the distance left to go (shorten duration if not much to do)
		// if (speed > 0.375) duration *= Math.abs(this.position - this.slide2slide(to));

		var swipeDrag = data.swipeDrag;

		// data.dragOff = 0;
		// data.scrollOff = 0;
		delete data.swipeDrag;
		delete data.swipeScroll;
		data.swipeMoves = [];

		// make offset value explicitly relative
		offset = offset < 0 ? offset : '+' + offset

		this.animate(offset, duration, easing, function ()
		{

			this.foobar = false;
			this.swiping = false;

		}, true);

		// return false if dragging
		return ! swipeDrag;

	});
	// @@@ EO plugin: swipeStop @@@


// EO extend class prototype
})(RTP.Slider.prototype, jQuery);