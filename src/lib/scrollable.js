// http://jsperf.com/jquery-scrollable

(function()
{

	jQuery.extend(jQuery.expr[":"],
	{

		'scrollable': function(element)
		{

			var vertically_scrollable, horizontally_scrollable;

			if
			(
				jQuery(element).css('overflow') == 'scroll' ||
				jQuery(element).css('overflowX') == 'scroll' ||
				jQuery(element).css('overflowY') == 'scroll'
			)
			{
				return true;
			}

			vertically_scrollable = (element.clientHeight < element.scrollHeight) &&
			(
				jQuery.inArray(jQuery(element).css('overflowY'), ['scroll', 'auto']) != -1 ||
				jQuery.inArray(jQuery(element).css('overflow'), ['scroll', 'auto']) != -1
			);

			if (vertically_scrollable) return true;

			horizontally_scrollable = (element.clientWidth < element.scrollWidth) &&
			(
				jQuery.inArray(jQuery(element).css('overflowX'), ['scroll', 'auto']) != -1 ||
				jQuery.inArray(jQuery(element).css('overflow'), ['scroll', 'auto']) != -1
			);

			return horizontally_scrollable;
		}

	});

})();
