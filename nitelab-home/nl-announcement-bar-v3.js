$(document).ready(function () {
	$('.js-offer-text').html(`
	    <div class="announcement-bar__wrap">
		    <div class="announcement-bar__header">
		        <div class="announcement-bar__heading">
		            LIMITED TIME SALE
		        </div>
		        <div class="announcement-bar__subheading">
		            60% OFF + 3 FREE GIFTS
		        </div>
		    </div>
		    <div class="announcement-bar__timer">
		        <div class="announcement-bar__block">
		            <div class="announcement-bar__time-text js-hrs">00</div>
		            <div class="announcement-bar__text-bottom">
		                HRS
		            </div>
		        </div>
		        <div class="announcement-bar__double-dot">
		            :
		        </div>
		        <div class="announcement-bar__block">
		            <div class="announcement-bar__time-text js-min">00</div>
		            <div class="announcement-bar__text-bottom">
		                MIN
		            </div>
		        </div>
		        <div class="announcement-bar__double-dot">
		            :
		        </div>
		        <div class="announcement-bar__block">
		            <div class="announcement-bar__time-text js-sec">00</div>
		            <div class="announcement-bar__text-bottom">
		                SEC
		            </div>
		        </div>
		    </div>
		</div>
	 `);

	function startUsMidnightCountdown() {
		function secondsUntilMidnightET() {
			try {
				var parts = new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' }).formatToParts(new Date());
				var get = function (t) { var p = parts.find(function (x) { return x.type === t; }); return parseInt(p.value, 10); };
				var h = get('hour') % 24, m = get('minute'), s = get('second');
				return (24 * 3600) - (h * 3600 + m * 60 + s);
			} catch (e) {
				var n = new Date();
				return (24 * 3600) - (n.getHours() * 3600 + n.getMinutes() * 60 + n.getSeconds());
			}
		}
		function updateCountdown() {
			var totalSeconds = secondsUntilMidnightET();
			if (totalSeconds <= 0 || totalSeconds > 24 * 3600) totalSeconds = 24 * 3600 - 1;
			var hours = Math.floor(totalSeconds / 3600);
			var minutes = Math.floor((totalSeconds % 3600) / 60);
			var seconds = totalSeconds % 60;
			$('.js-hrs').text(String(hours).padStart(2, '0'));
			$('.js-min').text(String(minutes).padStart(2, '0'));
			$('.js-sec').text(String(seconds).padStart(2, '0'));
			if (totalSeconds <= 600) {
				$('.announcement-bar__time-text').addClass('timer-danger');
			} else {
				$('.announcement-bar__time-text').removeClass('timer-danger');
			}
		}
		updateCountdown();
		setInterval(updateCountdown, 1000);
	}

	startUsMidnightCountdown();

	$('<style>')
		.prop('type', 'text/css')
		.html(`
		.product-slider-nav .slick-slide li{
			padding-bottom:0 !important;
		}
    	.announcement-bar__wrap {
	        display: flex;
	        align-items: center;
	        justify-content: center;
	    }
	    .announcement-bar__header{
	        margin-right: 24px;
	        text-align: center;
	        background: transparent !important;
	    }
	    .announcement-bar__heading, .announcement-bar__subheading {
	        background: transparent !important;
	    }
	    .announcement-bar__text-bottom { margin-top: 2px; line-height: 1.1; }

	    .announcement-bar__heading{
	        font-size: 24px;
	        line-height: 1.2;
	        font-weight: 700;
	        font-family: "Open Sans", sans-serif;
	        text-transform: uppercase;
	        letter-spacing: 0;
	    }

	    .announcement-bar__subheading {
	        font-family: "Open Sans", sans-serif;
	        font-size: 16px;
	        font-weight: 400;
	        line-height: 1.5;
	    }

	    .announcement-bar__timer {
	        display: flex;
	        justify-content: center;
	        align-items: flex-start;
	        gap: 6px;
	    }

	    .announcement-bar__time-text {
	        font-size: 18px;
	        font-weight: 700;
	        color: #1a1a1a;
            background-color:#fff;
	        min-width: 34px;
	        min-height: 34px;
	        display: flex;
	        align-items: center;
	        justify-content: center;
	        border-radius: 4px;
	        font-family: "Open Sans", sans-serif;
	    }

	    .announcement-bar__text-bottom {
	        font-size: 14px;
	        font-weight: 600;
	        line-height: 1.5;
	        font-family: "Open Sans", sans-serif;
	        margin-top: 5px;
	    }

	    .announcement-bar__double-dot {
	        font-size: 22px;
	        font-weight: bold;
	        font-family: "Open Sans", sans-serif;
	        margin-top: 6px;
	    }
        @media screen and (max-width:767px){
            .announcement-bar__heading {
                font-size: 18px;
            }
            .announcement-bar__subheading{
                font-size: 14px;
            }
            .announcement-bar__time-text{
                font-size: 16px;
                min-width: 30px;
                min-height: 30px;
            }
            .announcement-bar__text-bottom{
                font-size: 14px;
            }
        }
    `).appendTo('head');

	$('.js-product-offer-text').text("Limited Time Sale Live!");
	$('.productDescription').text('Save up to $110 while stocks last + get 3 FREE Bonuses when you order 2 or more mouthpieces');
	$('.js-n1-offer-text').html("<strong>Limited Time Special Offer</strong>: 60% OFF + 3 FREE GIFTS");
	$('.js-n1-announcement').html("LIMITED TIME SALE: <strong style='color:#D81E1E;'> 60% OFF + 3 FREE GIFTS</strong>");
	$('.js-n1-product-offer-text').text("Limited Time Special Offer");


	$('.js-ck-v6-announcement').text("LIMITED TIME SALE LIVE: Save Up to 60% + 3 Free Gifts");
	$('.js-ck-v6-yellow-text').text("LIMITED TIME SALE ENDING SOON!");
	$('.js-ck-v6-badge-text').text("LIMITED TIME DEAL");
	$('.js-ck-v6-free-product-offer-text').text("LIMITED TIME SALE LIVE:");

});