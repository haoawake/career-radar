// 「精选大厂」名单：用于只更新知名大型科技公司与主要科技雇主时缩小范围。
// 名字按去掉符号后的小写形式与注册表比对，写法不同不影响匹配。
export const MAJOR=`
Google,Apple,Amazon,Microsoft,Meta,Netflix,NVIDIA,Tesla,Intel,AMD,Qualcomm,Broadcom,Oracle,IBM,
Salesforce,Adobe,Cisco,Dell,HP,HPE,SAP,VMware,ServiceNow,Workday,Intuit,Autodesk,Synopsys,Cadence,
Texas Instruments,Micron,Applied Materials,Lam Research,KLA,Marvell,Analog Devices,Microchip Technology,
NXP Semiconductors,ON Semiconductor,Western Digital,Seagate,GlobalFoundries,Arista Networks,Juniper Networks,
NetApp,Pure Storage,Nutanix,Akamai,Cloudflare,Fastly,DigitalOcean,MongoDB,Elastic,Confluent,Snowflake,
Databricks,Datadog,Splunk,Dynatrace,HashiCorp,GitLab,Atlassian,Twilio,Stripe,Block,PayPal,Square,
Coinbase,Robinhood,Affirm,Chime,Brex,Ramp,Plaid,Marqeta,Visa,Mastercard,American Express,Capital One,
JPMorgan Chase,Goldman Sachs,Morgan Stanley,BlackRock,Fidelity,Charles Schwab,Bank of America,Wells Fargo,Citi,
Uber,Lyft,DoorDash,Instacart,Airbnb,Booking,Expedia,Zillow,Redfin,Opendoor,Compass,
LinkedIn,Pinterest,Snap,Reddit,Discord,Spotify,Roblox,Unity,Electronic Arts,Riot Games,Epic Games,
Twitch,Roku,Warner Bros Discovery,Paramount,Comcast,Disney,Walt Disney,Sony,
OpenAI,Anthropic,Perplexity,Scale AI,Figma,Notion,Canva,Airtable,Asana,Slack,Zoom,Dropbox,Box,
Palantir,Samsara,Rippling,Gusto,Deel,Toast,Klaviyo,Sentry,Vercel,Postman,Grammarly,Duolingo,
Palo Alto Networks,CrowdStrike,Crowdstrike,Zscaler,Okta,Fortinet,SentinelOne,Rubrik,Wiz,Snyk,
Qualtrics,Smartsheet,DocuSign,Veeva,Coupa,Anaplan,Zendesk,HubSpot,Shopify,eBay,Etsy,Wayfair,Chewy,
Walmart,Target,Costco,Home Depot,Best Buy,Nike,Starbucks,McDonalds,PepsiCo,Coca-Cola,Procter & Gamble,
Boeing,Lockheed Martin,Northrop Grumman,RTX,General Dynamics,L3Harris,Honeywell,GE Aerospace,SpaceX,
Ford,General Motors,Rivian,Lucid Motors,Waymo,Cruise,Zoox,Anduril,
Johnson & Johnson,Pfizer,Merck,Moderna,Eli Lilly,AbbVie,Amgen,Gilead,Genentech,Regeneron,Vertex,
Medtronic,Abbott,Stryker,Boston Scientific,Intuitive Surgical,Illumina,Thermo Fisher Scientific,
UnitedHealth Group,CVS Health,Cigna,Verizon,AT&T,T-Mobile,Accenture,Deloitte,McKinsey,
Bloomberg,S&P Global,Nasdaq,Two Sigma,Citadel,Jane Street,Hudson River Trading,Jump Trading,Optiver,IMC Trading,
`.split(/[,\n]/).map(s=>s.trim()).filter(Boolean).filter((v,i,a)=>a.indexOf(v)===i);
export const majorKeys=new Set(MAJOR.map(n=>n.toLowerCase().replace(/[^a-z0-9]/g,'')));
