(function(){
  if (window.__nlPdpExtra) return; window.__nlPdpExtra = 1;
  if (location.pathname.indexOf('/products/') === -1) return;

  var REVIEWS = [{"n": "Robert T.", "p": "https://cdn.shopify.com/s/files/1/0921/2582/3307/files/image-1787682113794.webp?v=1787682146&width=800", "t": ["Bought this after my doctor suggested I look into an oral device. Took two nights to get used to it, then nothing but quiet. My wife checked on me the third night because she thought something was wrong.", "The setting adjustment is what makes it work. I moved it one notch at a time until the snoring stopped completely."]}, {"n": "Sandra P.", "p": null, "t": ["I bought it for my husband and honestly did not expect much. Four nights in and the bedroom is silent. I sleep through now instead of nudging him every hour."]}, {"n": "Angela R.", "p": null, "t": ["Nose strips, tape, a wedge pillow, even a chin strap. This is the only thing that has actually made a difference for me."]}, {"n": "Douglas M.", "p": null, "t": ["Solid build and simple to rinse out in the morning. What sold me is that I can still breathe through my mouth if my nose is blocked."]}, {"n": "Patricia H.", "p": null, "t": ["Not only did the snoring stop, my jaw feels less tense in the morning. I did not expect that part at all."]}, {"n": "Frank D.", "p": null, "t": ["I was ready to be disappointed again. Instead I woke up genuinely rested for the first time in years. My energy in the afternoon is completely different."]}, {"n": "Neil C.", "p": null, "t": ["Works well for me. First week I drooled a bit at night, that settled down on its own. Would buy again."]}, {"n": "Sharon W.", "p": null, "t": ["I track my sleep with an app. I used to log four to six hours of snoring a night. First night with this it dropped to under twenty minutes."]}, {"n": "Gerald K.", "p": null, "t": ["Straightforward to set up and barely noticeable once it is in. Three nights to adjust and now I would not sleep without it."]}, {"n": "Wayne F.", "p": null, "t": ["I used to surface four or five times a night. Now I sleep straight through and wake up before my alarm."]}, {"n": "Dennis O.", "p": null, "t": ["No more arguments about who is keeping who awake. Worth every cent for that alone."]}, {"n": "Roger V.", "p": null, "t": ["My sleep app gave me a snore score of 71 before. Last week it averaged 18. The numbers speak for themselves."]}, {"n": "Harold N.", "p": null, "t": ["My wife told me I was stopping breathing at night and it frightened her. The first few nights my jaw ached a little, then it settled. She sleeps easier now and so do I."]}, {"n": "Eugene S.", "p": null, "t": ["Not the cheapest option out there, but it is the only one that worked. I would rather pay once for something that does the job."]}, {"n": "Marcus B.", "p": "https://cdn.shopify.com/s/files/1/0921/2582/3307/files/image-1787682099877.webp?v=1787682145&width=800", "t": ["I use it every single night now. My wife noticed the difference immediately and keeps telling people about it."]}, {"n": "Terry L.", "p": null, "t": ["By the third night the difference was obvious. It feels a bit odd at first, but you stop noticing it quickly."]}, {"n": "Vincent A.", "p": "https://cdn.shopify.com/s/files/1/0921/2582/3307/files/image-1787682123638.jpg?v=1787682145&width=800", "t": ["Honestly, I did not expect much when I ordered this. After the first few nights my wife told me the room was finally quiet — that alone was worth it. It sits comfortably and I barely notice it anymore while sleeping.", "Cleaning takes me less than a minute in the morning, just a quick rinse and it is ready again. Great product, NiteLab — I already recommended it to two friends at work."]}, {"n": "Curtis A.", "p": null, "t": ["Works well and I am sleeping much better. Already ordered a second one as a spare."]}, {"n": "Denise G.", "p": null, "t": ["I never realised how much my snoring was affecting my husband until it stopped. We are both getting proper rest now."]}, {"n": "Alan P.", "p": null, "t": ["I have tried a lot of mouthguards over the years. This one is thin enough that I can actually keep it in all night."]}, {"n": "Neil C.", "p": null, "t": ["Two or three nights to adjust and then it just becomes part of the routine. Worth the small effort."]}, {"n": "Glenn R.", "p": null, "t": ["Genuinely did not expect it to work this well. Very impressed."]}, {"n": "Todd M.", "p": null, "t": ["I have not felt this rested in years. A full uninterrupted night makes a bigger difference than I realised."]}, {"n": "Craig B.", "p": null, "t": ["Came across it online and took a chance. Pleasantly surprised by how much it helped."]}, {"n": "Marilyn J.", "p": null, "t": ["I ordered it for my father and he would not try it. Support refunded me within two days without any hassle. Good service."]}, {"n": "Carol S.", "p": null, "t": ["Not for me personally, but my husband swears by it. He had tried strips and white noise machines with no luck. This finally worked."]}, {"n": "Joyce T.", "p": null, "t": ["My husband uses it every night and I have put my earplugs away for good."]}, {"n": "Philip E.", "p": null, "t": ["After years of trying one thing after another, this is the first that actually holds up."]}, {"n": "Ray H.", "p": null, "t": ["My wife says I am finally quiet at night. That is the only review that matters in our house."]}, {"n": "Bruce W.", "p": null, "t": ["There is a short adjustment period, but it is a simple and elegant fix for something that bothered us for years."]}, {"n": "Stanley G.", "p": null, "t": ["Decided to give it a shot and it exceeded what I expected. Glad I did."]}];
  var FAQS = [{"q": "How does NiteLab Pro work?", "a": "It gently positions your jaw to reduce airway blockage, helping to prevent snoring. The adjustable settings let you customize the fit for the most effective and comfortable experience."}, {"q": "Is this a treatment for Sleep Apnea?", "a": "NiteLab is not intended to treat sleep apnea. It’s designed to reduce snoring in adults. If you have symptoms of sleep apnea, we recommend speaking with a healthcare professional to determine the best solution for you."}, {"q": "Is it comfortable to wear all night?", "a": "Experts and testers say a solid YES. The ultra-thin design makes it easy to wear, and the flexible material adapts to your mouth’s natural shape. It’s also side-sleeper friendly and stays in place throughout the night."}, {"q": "How do I adjust the settings for the best fit?", "a": "NiteLab Pro has 25 precision adjustment settings to fine-tune your jaw position. Simply detach and reattach the trays in the position you prefer. You can follow the included guide or watch our video tutorial for step-by-step instructions."}, {"q": "Is it safe to use?", "a": "Absolutely! NiteLab Pro is made from premium medical-grade, BPA-free materials, ensuring a safe and durable anti-snoring solution."}, {"q": "Does NiteLab Pro work for all mouth sizes?", "a": "Yes! With Adaptive Fit Technology, it flexes to fit your mouth comfortably, regardless of size or shape."}, {"q": "What if it doesn’t work for me?", "a": "We stand by our Quiet Nights Guarantee—try it risk-free for 90 nights. If you’re not satisfied, return it for a full refund. No hassle, no stress—just better sleep, guaranteed."}, {"q": "When will I receive my order?", "a": "We ship all our orders within 24-48 hours of receipt. You will be notified by email and given a tracking number that you can use to track your delivery on both our website and the courier's website."}, {"q": "Contraindications of use", "a": "Do not use it if you have central sleep apnea, severe respiratory disorder, asthma, loose teeth, or advanced periodontal disease, temporomandibular disorder, have a dental implant less than 1 year old, or are under the age of 18. Use of this device may cause tooth movement or changes in dental occlusion (bite pattern), tooth or gum soreness, pain or soreness of the jaw, obstruction of oral breathing, and excessive salivation. This product is not for the prevention of bruxism or teeth grinding."}];
  var VISIBLE = 12;

  var css = [
  '.nlpx-wrap{font-family:"Figtree",-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;color:#050A30;max-width:1100px;margin:0 auto;padding:40px 16px 60px}',
  '.nlpx-h2{font-size:34px;line-height:1.15;font-weight:700;text-align:center;margin:0 0 6px;color:#050A30}',
  '.nlpx-h2 span{color:#1C48B4}',
  '.nlpx-sub{text-align:center;font-size:17px;margin:0 0 28px;color:#050A30}',
  '.nlpx-sub b{color:#F59E0B}',
  '.nlpx-grid{column-count:2;column-gap:14px}',
  '@media(min-width:900px){.nlpx-grid{column-count:3}}',
  '@media(max-width:480px){.nlpx-grid{column-count:1}.nlpx-h2{font-size:28px}}',
  '.nlpx-card{background:#F7F7F9;border-radius:10px;padding:0 0 14px;margin:0 0 14px;break-inside:avoid;overflow:hidden}',
  '.nlpx-card img{width:100%%;height:auto;display:block;border-radius:10px 10px 0 0}',
  '.nlpx-card-inner{padding:14px 16px 0}',
  '.nlpx-name{font-weight:700;font-size:18px;margin:0 0 4px}',
  '.nlpx-vp{display:flex;align-items:center;gap:6px;font-size:13px;margin:0 0 10px;color:#050A30}',
  '.nlpx-vp svg{flex:none}',
  '.nlpx-txt{font-size:15px;line-height:1.5;margin:0 0 10px}',
  '.nlpx-more{display:none}',
  '.nlpx-open .nlpx-more{display:block}',
  '.nlpx-btn{display:block;margin:10px auto 0;background:#F7F7F9;color:#050A30;border:0;border-radius:8px;padding:14px 34px;font-size:15px;font-weight:600;letter-spacing:1px;cursor:pointer;font-family:inherit}',
  '.nlpx-btn:hover{background:#ececf1}',
  '.nlpx-faq-h{font-size:34px;font-weight:700;text-align:center;margin:46px 0 18px;color:#050A30}',
  '.nlpx-faq{max-width:760px;margin:0 auto}',
  '.nlpx-faq details{border-bottom:1px dotted #000;padding:14px 0}',
  '.nlpx-faq summary{display:flex;justify-content:space-between;align-items:center;gap:12px;cursor:pointer;list-style:none;font-size:18px;font-weight:600;color:#050A30}',
  '.nlpx-faq summary::-webkit-details-marker{display:none}',
  '.nlpx-faq summary:after{content:"+";font-size:22px;font-weight:600;flex:none}',
  '.nlpx-faq details[open] summary:after{content:"\\2212"}',
  '.nlpx-faq .nlpx-a{font-size:16px;line-height:1.55;padding:10px 0 2px;color:#050A30}',
  '@media(max-width:480px){.nlpx-faq-h{font-size:28px}.nlpx-faq summary{font-size:16px}}'
  ].join('');

  var CHECK = '<svg width="15" height="15" viewBox="0 0 16 16" fill="none"><circle cx="8" cy="8" r="8" fill="#1C48B4"/><path d="M4.5 8.2l2.3 2.3 4.7-4.9" stroke="#fff" stroke-width="1.6" fill="none"/></svg>';

  function esc(s){var d=document.createElement('div');d.textContent=s;return d.innerHTML;}

  function build(){
    if (document.getElementById('nlpx-root')) return;
    var main = document.getElementById('MainContent') || document.querySelector('main') || document.body;
    var style = document.createElement('style'); style.textContent = css.replace(/%%/g,'%'); document.head.appendChild(style);

    var root = document.createElement('div'); root.id = 'nlpx-root';
    var html = '<div class="nlpx-wrap"><h2 class="nlpx-h2">See what our <span>former snorers say!</span></h2>';
    html += '<p class="nlpx-sub">Over <b>250k+</b> verified reviews and counting</p>';
    html += '<div class="nlpx-grid" id="nlpx-grid">';
    REVIEWS.forEach(function(r, i){
      html += '<div class="nlpx-card'+(i >= VISIBLE ? ' nlpx-more' : '')+'">';
      if (r.p) html += '<img loading="lazy" src="'+r.p+'" alt="'+esc(r.n)+' review photo">';
      html += '<div class="nlpx-card-inner"><div class="nlpx-name">'+esc(r.n)+'</div>';
      html += '<div class="nlpx-vp">'+CHECK+' Verified Purchase</div>';
      r.t.forEach(function(t){ html += '<p class="nlpx-txt">'+esc(t)+'</p>'; });
      html += '</div></div>';
    });
    html += '</div><button type="button" class="nlpx-btn" id="nlpx-viewmore">VIEW MORE</button>';
    html += '<h2 class="nlpx-faq-h">FAQs</h2><div class="nlpx-faq">';
    FAQS.forEach(function(f){
      html += '<details><summary>'+esc(f.q)+'</summary><div class="nlpx-a">'+esc(f.a)+'</div></details>';
    });
    html += '</div></div>';
    root.innerHTML = html;
    main.appendChild(root);

    var btn = document.getElementById('nlpx-viewmore');
    btn.addEventListener('click', function(){
      document.getElementById('nlpx-grid').classList.add('nlpx-open');
      btn.style.display = 'none';
    });
    if (REVIEWS.length <= VISIBLE) btn.style.display = 'none';
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', build, {once:true}); else build();
})();