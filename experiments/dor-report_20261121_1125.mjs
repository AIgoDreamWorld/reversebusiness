import fs from 'node:fs';
import path from 'node:path';
const root=path.resolve(import.meta.dirname,'..');

const output=path.join(root,'reports','dor_20261121_1125'); fs.mkdirSync(output,{recursive:true});
const original=output;
const r=JSON.parse(fs.readFileSync(path.join(original,'collector-draft.json'),'utf8'));
const c=(text,status,evidence=[])=>({text,status,evidence});
const o=(text,evidence)=>c(text,'observed',evidence);
const i=(text,evidence)=>c(text,'inferred',evidence);
const u=(text)=>c(text,'unknown',[]);
const ev=[
['E4','https://thedorbrothers.com/ai-video-production-cost/','Published price guidance, per-project quote, scope, delivery and timelines.'],
['E5','https://thedorbrothers.com/ai-commercials/','Commercial clients, production and delivery described by studio.'],
['E6','https://thedorbrothers.com/privacy/','Official privacy policy updated 31 Oct 2026. Brief to email inbox, newsletter to Mailchimp, Cloudflare host. Not Terms of Service.'],
['E7','https://thedorbrothers.com/ai-films/','Film production service, quoted scope and typical timeline.'],
['E8','https://thedorbrothers.com/contact/','Six-step project brief. No form submission.'],
['E9','https://thedorbrothers.com/about/','Self-published studio and client portfolio.']];
r.evidence.push(...ev.map(([id,ref,note])=>({id,type:'url',ref,note,seen_at:'2026-11-21',seen:'page'})));
r.meta.analyst='GOAL 02: read-only manual synthesis over original REA evidence and official public pages';
r.meta.scope='Original REA inspected the rendered homepage with passive flow only; additional official pricing, commercials, films, contact, about and privacy pages were manually read without browser interactions. No account, form submission, contracts, revenue analytics or code-level exploration. Original REA scope unchanged.';
r.meta.method.push('Human-reviewed official public pages E4-E9 as secondary evidence; not REA-inspected pages.');
r.meta.terms={status:'not-found',note:'REA robots.txt checked (E2) and public privacy policy reviewed (E6); a separate Terms of Service governing deep code-level analysis was not verified. Privacy is not terms. Code reading remains skipped and independent audit remains HOLD.',evidence:['E2','E6']};
r.meta.one_line='The Dor Brothers sells bespoke AI film and commercial production to brands and agencies through portfolio-led inquiries and custom quotes; newsletter signup is separate, and sales figures are unverified.';
r.meta.draft=false;
r.sections.money={
customer:[o('Official site describes target clients as brands, agencies, artists and technology companies. Portfolio is the studio own claim, not independently audited customer proof.',['E1','E5','E9'])],
problem:[i('Studio offers creative and AI video production from concept and script to delivery, plausibly addressing demand for professional promotional video without organizing a conventional shoot. Customer pain is not measured.',['E5','E7'])],
price:[o('Official site: projects start at USD 15,000; commercials usually USD 50,000-125,000; individual quotes depend on length, scope and deliverables. These are advertised price guidance, not actual closed deals.',['E4']),o('Home brief has selectable budget bands USD 15k-50k, 50k-100k, 100k-300k, 300k+ and uncertain. These are form choices, not completed contract values.',['E1','E8'])],
revenue:[]};
r.sections.flow.steps=[
{stage:'arrive',label:'포트폴리오 발견',...o('Public landing page shows a showreel, film/commercial/music/viral work, selected clients and Start a Project. Actual acquisition channels are not verified.',['E1'])},
{stage:'first_value',label:'제작 역량 검토',...i('A potential client may assess the showreel and selected projects before inquiring; actual visitor behavior is unmeasured.',['E1','E5'])},
{stage:'signup',label:'뉴스레터 구독 (계정 아님)',...o('The Subscribe section Sign Up asks for email news/updates. Privacy says it goes to Mailchimp. Project brief explicitly says No account, no mailing list, and is separate. No account creation was verified.',['E1','E6'])},
{stage:'payment',label:'제작 의뢰와 개별 견적',...o('The six-step project brief asks service type, budget, subject, details, name/company and email. Public pricing page promises a custom quote; no checkout or private contract was observed.',['E1','E4','E8'])},
{stage:'return',label:'뉴스레터·후속 작품',...i('Newsletter and portfolio/social links may encourage return visits; retention and repeat customer data are unknown.',['E1','E6'])}];
r.sections.map.screens=[
{name:'Home /',purpose:'Portfolio evidence, positioning and project inquiry.',features:['showreel','client and work sections','Start a Project','project brief','separate Subscribe'],status:'observed',evidence:['E1']},
{name:'Pricing /ai-video-production-cost/',purpose:'Published starting prices and factors for custom quotations.',features:['minimum USD 15000','typical commercials USD 50000-125000','project-specific quote'],status:'observed',evidence:['E4']},
{name:'Commercials /ai-commercials/',purpose:'Demonstrate selected commercial work and brief-concept-production-delivery steps.',features:['client type','AI commercial work','deliverable format'],status:'observed',evidence:['E5']},
{name:'Contact /contact/',purpose:'Six-step inbound quote request, without submitted form.',features:['type','budget','subject','description','name/company','email'],status:'observed',evidence:['E8']},
{name:'Privacy /privacy/',purpose:'Published data handling claims; not Terms of Service.',features:['brief email handling','Mailchimp newsletter','Cloudflare hosting'],status:'observed',evidence:['E6']}];
r.sections.tech.items=[
{layer:'Web surface',...o('REA passive inspection reported rendered HTML, script resources and Cloudflare response header; the passive flow observed external host names without payload (E3). Backend code is not authenticated.',['E1','E3'])},
{layer:'Disclosed integration',...o('Privacy Policy states brief is emailed to the studio via Cloudflare, Google Workspace hosts mailbox, and newsletter list is held by Mailchimp; self-reported implementation.',['E6'])},
{layer:'Production approach',...o('Studio describes multiple AI video models plus its own workflows and normal editing, sound and color post-production.',['E5','E7'])},
{layer:'Private implementation',...u('Private server source, database, prompts, actual production costs and model configuration were not inspected.')}];
r.sections.unknowns=[
{question:'Audited revenue, profitability, conversion rate, exact project deal prices',why:'Only published price guidance and self-reported portfolio stats are available.',next:'Record UNKNOWN until independently authenticated primary evidence exists.'},
{question:'Account, actual checkout, billing and contract terms',why:'Inquiry is not registration or payment; private client path was not accessed.',next:'Do not fabricate payments or post-contract screens.'},
{question:'Separate Terms of Service for deeper automated inspection',why:'Privacy page was reviewed; a separate terms document was not verified.',next:'Legal review or explicit authorization needed before any code-level step.'},
{question:'Independent proof of customers, views, project count',why:'Client and audience claims are stated by company; no exhaustive independent audit.',next:'Check client publishing records separately.'},
{question:'Actual tech stack and internal proprietary video pipeline',why:'No authorized code/deep inspection or private technical documentation.',next:'Record only publicly stated facts.'},
{question:'Newsletter conversion, return visits, repeat business',why:'Not publicly measurable from static pages.',next:'Keep metrics UNKNOWN.'}];
fs.writeFileSync(path.join(output,'report.json'),JSON.stringify(r,null,2)+'\n','utf8');
console.log('REPORT_PATH='+path.join(output,'report.json'));
console.log('CLAIMS='+r.evidence.length+' evidence entries');
