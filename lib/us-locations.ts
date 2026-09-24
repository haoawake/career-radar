// 美国地点识别：把来源提供的自由文本地点解析为州、都会区与城市，供地区筛选使用。
export const STATES:Record<string,string>={alabama:'AL',alaska:'AK',arizona:'AZ',arkansas:'AR',california:'CA',colorado:'CO',connecticut:'CT',delaware:'DE',florida:'FL',georgia:'GA',hawaii:'HI',idaho:'ID',illinois:'IL',indiana:'IN',iowa:'IA',kansas:'KS',kentucky:'KY',louisiana:'LA',maine:'ME',maryland:'MD',massachusetts:'MA',michigan:'MI',minnesota:'MN',mississippi:'MS',missouri:'MO',montana:'MT',nebraska:'NE',nevada:'NV','new hampshire':'NH','new jersey':'NJ','new mexico':'NM','new york':'NY','north carolina':'NC','north dakota':'ND',ohio:'OH',oklahoma:'OK',oregon:'OR',pennsylvania:'PA','rhode island':'RI','south carolina':'SC','south dakota':'SD',tennessee:'TN',texas:'TX',utah:'UT',vermont:'VT',virginia:'VA',washington:'WA','west virginia':'WV',wisconsin:'WI',wyoming:'WY','district of columbia':'DC','washington dc':'DC','puerto rico':'PR'};
export const METROS:{id:string;name:string;states:string[]}[]=[
 {id:'bay-area',name:'旧金山湾区',states:['CA']},
 {id:'nyc',name:'纽约都会区',states:['NY','NJ','CT']},
 {id:'seattle',name:'西雅图都会区',states:['WA']},
 {id:'los-angeles',name:'洛杉矶 / 南加州',states:['CA']},
 {id:'san-diego',name:'圣地亚哥',states:['CA']},
 {id:'boston',name:'波士顿都会区',states:['MA','NH']},
 {id:'dc',name:'华盛顿特区都会区',states:['DC','VA','MD']},
 {id:'austin',name:'奥斯汀',states:['TX']},
 {id:'dallas',name:'达拉斯 / 沃斯堡',states:['TX']},
 {id:'houston',name:'休斯敦',states:['TX']},
 {id:'san-antonio',name:'圣安东尼奥 / 西德州',states:['TX']},
 {id:'chicago',name:'芝加哥都会区',states:['IL']},
 {id:'denver',name:'丹佛 / 博尔德',states:['CO']},
 {id:'atlanta',name:'亚特兰大',states:['GA']},
 {id:'raleigh',name:'罗利 / 三角研究园',states:['NC']},
 {id:'charlotte',name:'夏洛特 / 卡罗来纳',states:['NC','SC']},
 {id:'phoenix',name:'凤凰城 / 亚利桑那',states:['AZ']},
 {id:'portland',name:'波特兰',states:['OR']},
 {id:'salt-lake-city',name:'盐湖城 / 犹他',states:['UT']},
 {id:'philadelphia',name:'费城都会区',states:['PA','DE']},
 {id:'miami',name:'迈阿密 / 南佛罗里达',states:['FL']},
 {id:'orlando',name:'奥兰多',states:['FL']},
 {id:'tampa',name:'坦帕 / 杰克逊维尔',states:['FL']},
 {id:'minneapolis',name:'明尼阿波利斯',states:['MN']},
 {id:'detroit',name:'底特律 / 密歇根',states:['MI']},
 {id:'pittsburgh',name:'匹兹堡',states:['PA']},
 {id:'columbus',name:'哥伦布',states:['OH']},
 {id:'cleveland',name:'克利夫兰 / 辛辛那提',states:['OH']},
 {id:'nashville',name:'纳什维尔 / 田纳西',states:['TN']},
 {id:'st-louis',name:'圣路易斯 / 堪萨斯城',states:['MO','KS']},
 {id:'indianapolis',name:'印第安纳波利斯',states:['IN']},
 {id:'madison',name:'麦迪逊 / 密尔沃基',states:['WI']},
 {id:'las-vegas',name:'拉斯维加斯 / 内华达',states:['NV']},
 {id:'sacramento',name:'萨克拉门托 / 中央谷地',states:['CA']},
 {id:'new-orleans',name:'新奥尔良 / 路易斯安那',states:['LA']},
 {id:'oklahoma-city',name:'俄克拉何马城 / 塔尔萨',states:['OK']},
 {id:'richmond',name:'里士满 / 弗吉尼亚其他',states:['VA']},
 {id:'baltimore',name:'巴尔的摩',states:['MD']},
 {id:'upstate-ny',name:'纽约州北部',states:['NY']},
 {id:'other-us',name:'其他美国地点',states:[]},
];
// [英文城市名, 州, 都会区, 中文名, 别名…]
const CITY_TABLE:[string,string,string,string,...string[]][]=[
 ['San Francisco','CA','bay-area','旧金山','SF','South San Francisco','San Francisco Bay Area','Bay Area'],
 ['San Jose','CA','bay-area','圣何塞'],
 ['Sunnyvale','CA','bay-area','桑尼维尔'],['Santa Clara','CA','bay-area','圣克拉拉'],['Mountain View','CA','bay-area','山景城'],
 ['Palo Alto','CA','bay-area','帕洛阿尔托'],['Cupertino','CA','bay-area','库比蒂诺'],['Menlo Park','CA','bay-area','门洛帕克'],
 ['Redwood City','CA','bay-area','红木城'],['San Mateo','CA','bay-area','圣马特奥'],['Foster City','CA','bay-area','福斯特城'],
 ['Burlingame','CA','bay-area','伯林盖姆'],['Fremont','CA','bay-area','弗里蒙特'],['Milpitas','CA','bay-area','米尔皮塔斯'],
 ['Oakland','CA','bay-area','奥克兰'],['Berkeley','CA','bay-area','伯克利'],['Emeryville','CA','bay-area','埃默里维尔'],
 ['Pleasanton','CA','bay-area','普莱森顿'],['San Ramon','CA','bay-area','圣拉蒙'],['Walnut Creek','CA','bay-area','核桃溪'],
 ['Santa Rosa','CA','bay-area','圣罗莎'],['Livermore','CA','bay-area','利弗莫尔'],['Hayward','CA','bay-area','海沃德'],
 ['San Carlos','CA','bay-area','圣卡洛斯'],['Campbell','CA','bay-area','坎贝尔'],['Los Gatos','CA','bay-area','洛斯加托斯'],
 ['Alameda','CA','bay-area','阿拉米达'],['Union City','CA','bay-area','联合城'],['Concord','CA','bay-area','康科德'],
 ['Santa Cruz','CA','bay-area','圣克鲁兹'],['Newark','CA','bay-area','纽瓦克（加州）'],
 ['New York','NY','nyc','纽约','New York City','NYC','Manhattan','Brooklyn','Queens'],
 ['Jersey City','NJ','nyc','泽西城'],['Hoboken','NJ','nyc','霍博肯'],['Newark','NJ','nyc','纽瓦克'],
 ['Stamford','CT','nyc','斯坦福德'],['Greenwich','CT','nyc','格林尼治'],['Norwalk','CT','nyc','诺沃克'],
 ['White Plains','NY','nyc','白原市'],['Long Island City','NY','nyc','长岛市'],['Armonk','NY','nyc','阿蒙克'],
 ['Princeton','NJ','nyc','普林斯顿'],['Basking Ridge','NJ','nyc','巴斯金里奇'],['Morristown','NJ','nyc','莫里斯敦'],
 ['Iselin','NJ','nyc','伊瑟林'],['Weehawken','NJ','nyc','威霍肯'],['Yonkers','NY','nyc','扬克斯'],
 ['Seattle','WA','seattle','西雅图'],['Bellevue','WA','seattle','贝尔维尤'],['Redmond','WA','seattle','雷德蒙德'],
 ['Kirkland','WA','seattle','柯克兰'],['Renton','WA','seattle','伦顿'],['Everett','WA','seattle','埃弗里特'],
 ['Tacoma','WA','seattle','塔科马'],['Bothell','WA','seattle','博塞尔'],['Issaquah','WA','seattle','伊瑟阔'],
 ['Vancouver','WA','seattle','温哥华（华州）'],['Spokane','WA','seattle','斯波坎'],
 ['Los Angeles','CA','los-angeles','洛杉矶'],['Santa Monica','CA','los-angeles','圣莫尼卡'],['Culver City','CA','los-angeles','卡尔弗城'],
 ['Pasadena','CA','los-angeles','帕萨迪纳'],['Burbank','CA','los-angeles','伯班克'],['Glendale','CA','los-angeles','格伦代尔'],
 ['El Segundo','CA','los-angeles','埃尔塞贡多'],['Irvine','CA','los-angeles','尔湾'],['Costa Mesa','CA','los-angeles','科斯塔梅萨'],
 ['Anaheim','CA','los-angeles','阿纳海姆'],['Long Beach','CA','los-angeles','长滩'],['Torrance','CA','los-angeles','托伦斯'],
 ['Playa Vista','CA','los-angeles','普拉亚维斯塔'],['Hawthorne','CA','los-angeles','霍桑'],['Thousand Oaks','CA','los-angeles','千橡市'],
 ['Newport Beach','CA','los-angeles','新港滩'],['Riverside','CA','los-angeles','河滨市'],['Santa Barbara','CA','los-angeles','圣巴巴拉'],
 ['Huntington Beach','CA','los-angeles','亨廷顿海滩'],['Camarillo','CA','los-angeles','卡马里奥'],['Goleta','CA','los-angeles','戈利塔'],
 ['San Diego','CA','san-diego','圣地亚哥'],['Carlsbad','CA','san-diego','卡尔斯巴德'],['La Jolla','CA','san-diego','拉霍亚'],
 ['Boston','MA','boston','波士顿'],['Cambridge','MA','boston','剑桥（麻州）'],['Somerville','MA','boston','萨默维尔'],
 ['Waltham','MA','boston','沃尔瑟姆'],['Burlington','MA','boston','伯灵顿（麻州）'],['Bedford','MA','boston','贝德福德'],
 ['Lexington','MA','boston','列克星敦'],['Andover','MA','boston','安多佛'],['Marlborough','MA','boston','马尔伯勒'],
 ['Needham','MA','boston','尼德姆'],['Quincy','MA','boston','昆西'],['Worcester','MA','boston','伍斯特'],
 ['Nashua','NH','boston','纳舒厄'],['Manchester','NH','boston','曼彻斯特'],
 ['Washington','DC','dc','华盛顿特区','Washington DC','District of Columbia'],
 ['Arlington','VA','dc','阿灵顿'],['Alexandria','VA','dc','亚历山德里亚'],['Reston','VA','dc','雷斯顿'],
 ['McLean','VA','dc','麦克莱恩'],['Herndon','VA','dc','赫恩登'],['Tysons','VA','dc','泰森斯','Tysons Corner'],
 ['Chantilly','VA','dc','尚蒂伊'],['Fairfax','VA','dc','费尔法克斯'],['Ashburn','VA','dc','阿什本'],
 ['Bethesda','MD','dc','贝塞斯达'],['Rockville','MD','dc','罗克维尔'],['Silver Spring','MD','dc','银泉'],
 ['Austin','TX','austin','奥斯汀'],['Round Rock','TX','austin','圆石城'],['Bastrop','TX','austin','巴斯特罗普'],['Georgetown','TX','austin','乔治敦'],
 ['Dallas','TX','dallas','达拉斯'],['Plano','TX','dallas','普莱诺'],['Irving','TX','dallas','欧文'],
 ['Richardson','TX','dallas','理查森'],['Frisco','TX','dallas','弗里斯科'],['Fort Worth','TX','dallas','沃斯堡'],
 ['Addison','TX','dallas','阿迪森'],['Westlake','TX','dallas','西湖镇'],
 ['Houston','TX','houston','休斯敦'],['Sugar Land','TX','houston','糖城'],['The Woodlands','TX','houston','伍德兰兹'],
 ['San Antonio','TX','san-antonio','圣安东尼奥'],['El Paso','TX','san-antonio','埃尔帕索'],['Lubbock','TX','san-antonio','拉伯克'],
 ['Chicago','IL','chicago','芝加哥'],['Evanston','IL','chicago','埃文斯顿'],['Naperville','IL','chicago','内珀维尔'],
 ['Schaumburg','IL','chicago','绍姆堡'],['Deerfield','IL','chicago','迪尔菲尔德'],['Northbrook','IL','chicago','北布鲁克'],
 ['Denver','CO','denver','丹佛'],['Boulder','CO','denver','博尔德'],['Broomfield','CO','denver','布鲁姆菲尔德'],
 ['Colorado Springs','CO','denver','科罗拉多斯普林斯'],['Fort Collins','CO','denver','柯林斯堡'],
 ['Atlanta','GA','atlanta','亚特兰大'],['Alpharetta','GA','atlanta','阿尔法利塔'],['Sandy Springs','GA','atlanta','桑迪斯普林斯'],
 ['Savannah','GA','atlanta','萨凡纳'],
 ['Raleigh','NC','raleigh','罗利'],['Durham','NC','raleigh','达勒姆'],['Cary','NC','raleigh','卡里'],
 ['Chapel Hill','NC','raleigh','教堂山'],['Research Triangle Park','NC','raleigh','三角研究园'],
 ['Charlotte','NC','charlotte','夏洛特'],['Greensboro','NC','charlotte','格林斯伯勒'],['Greenville','SC','charlotte','格林维尔'],
 ['Charleston','SC','charlotte','查尔斯顿'],['Columbia','SC','charlotte','哥伦比亚（南卡）'],
 ['Phoenix','AZ','phoenix','凤凰城'],['Tempe','AZ','phoenix','坦佩'],['Scottsdale','AZ','phoenix','斯科茨代尔'],
 ['Chandler','AZ','phoenix','钱德勒'],['Mesa','AZ','phoenix','梅萨'],['Tucson','AZ','phoenix','图森'],
 ['Portland','OR','portland','波特兰'],['Beaverton','OR','portland','比弗顿'],['Hillsboro','OR','portland','希尔斯伯勒'],
 ['Salem','OR','portland','塞勒姆'],
 ['Salt Lake City','UT','salt-lake-city','盐湖城'],['Lehi','UT','salt-lake-city','利希'],['Draper','UT','salt-lake-city','德雷珀'],
 ['Provo','UT','salt-lake-city','普罗沃'],['South Jordan','UT','salt-lake-city','南约旦'],
 ['Philadelphia','PA','philadelphia','费城'],['King of Prussia','PA','philadelphia','普鲁士王'],['Malvern','PA','philadelphia','马尔文'],
 ['Conshohocken','PA','philadelphia','康舍霍肯'],['Wilmington','DE','philadelphia','威尔明顿'],
 ['Miami','FL','miami','迈阿密'],['Fort Lauderdale','FL','miami','劳德代尔堡'],['Boca Raton','FL','miami','博卡拉顿'],
 ['West Palm Beach','FL','miami','西棕榈滩'],['Doral','FL','miami','多拉尔'],['Naples','FL','miami','那不勒斯'],
 ['Orlando','FL','orlando','奥兰多'],['Cape Canaveral','FL','orlando','卡纳维拉尔角'],['Merritt Island','FL','orlando','梅里特岛'],['Lake Mary','FL','orlando','莱克玛丽'],['Melbourne','FL','orlando','墨尔本（佛州）'],
 ['Tampa','FL','tampa','坦帕'],['St. Petersburg','FL','tampa','圣彼得堡（佛州）'],['Jacksonville','FL','tampa','杰克逊维尔'],
 ['Sarasota','FL','tampa','萨拉索塔'],['Gainesville','FL','tampa','盖恩斯维尔'],['Tallahassee','FL','tampa','塔拉哈西'],
 ['Minneapolis','MN','minneapolis','明尼阿波利斯'],['St. Paul','MN','minneapolis','圣保罗'],['Eden Prairie','MN','minneapolis','伊登普雷里'],
 ['Bloomington','MN','minneapolis','布卢明顿'],['Rochester','MN','minneapolis','罗切斯特（明州）'],['Duluth','MN','minneapolis','德卢斯'],
 ['Detroit','MI','detroit','底特律'],['Ann Arbor','MI','detroit','安娜堡'],['Dearborn','MI','detroit','迪尔伯恩'],
 ['Warren','MI','detroit','沃伦'],['Troy','MI','detroit','特洛伊'],['Grand Rapids','MI','detroit','大急流城'],
 ['Lansing','MI','detroit','兰辛'],['Kalamazoo','MI','detroit','卡拉马祖'],
 ['Pittsburgh','PA','pittsburgh','匹兹堡'],['State College','PA','pittsburgh','州立学院镇'],
 ['Columbus','OH','columbus','哥伦布'],['Dublin','OH','columbus','都柏林（俄亥俄）'],['Heath','OH','columbus','希思'],['New Albany','OH','columbus','新奥尔巴尼'],
 ['Cleveland','OH','cleveland','克利夫兰'],['Cincinnati','OH','cleveland','辛辛那提'],['Dayton','OH','cleveland','代顿'],
 ['Akron','OH','cleveland','阿克伦'],['Toledo','OH','cleveland','托莱多'],
 ['Nashville','TN','nashville','纳什维尔'],['Memphis','TN','nashville','孟菲斯'],['Knoxville','TN','nashville','诺克斯维尔'],
 ['St. Louis','MO','st-louis','圣路易斯'],['Kansas City','MO','st-louis','堪萨斯城'],['Overland Park','KS','st-louis','奥弗兰帕克'],
 ['Wichita','KS','st-louis','威奇托'],['Topeka','KS','st-louis','托皮卡'],
 ['Indianapolis','IN','indianapolis','印第安纳波利斯'],['Carmel','IN','indianapolis','卡梅尔'],['Fishers','IN','indianapolis','费舍斯'],
 ['Madison','WI','madison','麦迪逊'],['Milwaukee','WI','madison','密尔沃基'],['Green Bay','WI','madison','绿湾'],
 ['Las Vegas','NV','las-vegas','拉斯维加斯'],['Reno','NV','las-vegas','里诺'],['Henderson','NV','las-vegas','亨德森'],
 ['Sacramento','CA','sacramento','萨克拉门托'],['Folsom','CA','sacramento','福尔松'],['Roseville','CA','sacramento','罗斯维尔'],
 ['Fresno','CA','sacramento','弗雷斯诺'],['Bakersfield','CA','sacramento','贝克斯菲尔德'],['Stockton','CA','sacramento','斯托克顿'],
 ['Modesto','CA','sacramento','莫德斯托'],['Vacaville','CA','sacramento','瓦卡维尔'],
 ['New Orleans','LA','new-orleans','新奥尔良'],['Baton Rouge','LA','new-orleans','巴吞鲁日'],
 ['Oklahoma City','OK','oklahoma-city','俄克拉何马城'],['Tulsa','OK','oklahoma-city','塔尔萨'],
 ['Richmond','VA','richmond','里士满'],['Norfolk','VA','richmond','诺福克'],['Charlottesville','VA','richmond','夏洛茨维尔'],
 ['Baltimore','MD','baltimore','巴尔的摩'],['Annapolis','MD','baltimore','安纳波利斯'],['Hunt Valley','MD','baltimore','亨特谷'],
 ['Albany','NY','upstate-ny','奥尔巴尼'],['Rochester','NY','upstate-ny','罗切斯特'],['Buffalo','NY','upstate-ny','布法罗'],
 ['Syracuse','NY','upstate-ny','锡拉丘兹'],['Ithaca','NY','upstate-ny','伊萨卡'],
 ['Boise','ID','other-us','博伊西'],['Omaha','NE','other-us','奥马哈'],['Lincoln','NE','other-us','林肯'],
 ['Des Moines','IA','other-us','得梅因'],['Cedar Rapids','IA','other-us','锡达拉皮兹'],['Ames','IA','other-us','埃姆斯'],
 ['Little Rock','AR','other-us','小石城'],['Bentonville','AR','other-us','本顿维尔'],
 ['Birmingham','AL','other-us','伯明翰'],['Huntsville','AL','other-us','亨茨维尔'],
 ['Louisville','KY','other-us','路易斯维尔'],['Covington','KY','other-us','科文顿'],
 ['Jackson','MS','other-us','杰克逊'],['Honolulu','HI','other-us','檀香山'],['Anchorage','AK','other-us','安克雷奇'],
 ['Albuquerque','NM','other-us','阿尔伯克基'],['Santa Fe','NM','other-us','圣菲'],['Los Alamos','NM','other-us','洛斯阿拉莫斯'],
 ['Providence','RI','other-us','普罗维登斯'],['Hartford','CT','other-us','哈特福德'],['New Haven','CT','other-us','纽黑文'],
 ['Burlington','VT','other-us','伯灵顿（佛蒙特）'],['Fargo','ND','other-us','法戈'],['Sioux Falls','SD','other-us','苏福尔斯'],
 ['Billings','MT','other-us','比林斯'],['Cheyenne','WY','other-us','夏延'],['Charleston','WV','other-us','查尔斯顿（西弗）'],
 ['Allentown','PA','other-us','阿伦敦'],['Harrisburg','PA','other-us','哈里斯堡'],
 ['Urbana','IL','other-us','厄巴纳'],['Champaign','IL','other-us','香槟市'],['Peoria','IL','other-us','皮奥里亚'],
 ['College Station','TX','other-us','大学城'],['Starbase','TX','other-us','星舰基地'],['Brownsville','TX','other-us','布朗斯维尔'],['McGregor','TX','other-us','麦格雷戈'],['Amarillo','TX','other-us','阿马里洛'],['Waco','TX','other-us','韦科'],
 ['Corpus Christi','TX','other-us','科珀斯克里斯蒂'],['San Luis Obispo','CA','other-us','圣路易斯奥比斯波'],
];
export type UsLocation={cities:string[];states:string[];metros:string[];remote:boolean};
export const CITIES=CITY_TABLE.map(([name,state,metro,zh])=>({id:name.toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'')+'-'+state.toLowerCase(),name,zh,state,metro}));
const CITY_INDEX=new Map<string,typeof CITIES>();
CITY_TABLE.forEach(([name,,,,...aliases],i)=>{for(const key of [name,...aliases]){const k=key.toLowerCase();CITY_INDEX.set(k,[...(CITY_INDEX.get(k)||[]),CITIES[i]])}});
const CITY_KEYS=[...CITY_INDEX.keys()].sort((a,b)=>b.length-a.length);
const STATE_CODES=new Set(Object.values(STATES));
// 只有当某州唯一对应一个都会区时，才能由州反推都会区；加州、德州等跨多个都会区的州归入其他美国地点。
// 出现明确的非美国国家或加拿大省份时不再按城市名匹配，避免 Vancouver, BC 或 Dublin, Ireland 被当成美国城市。
const NON_US=/\b(canada|mexico|brazil|argentina|chile|colombia|costa rica|india|china|taiwan|hong kong|singapore|japan|korea|malaysia|philippines|vietnam|thailand|indonesia|australia|new zealand|israel|united kingdom|england|scotland|ireland|germany|france|spain|portugal|italy|netherlands|belgium|switzerland|austria|sweden|norway|denmark|finland|poland|czech|romania|hungary|greece|turkey|ukraine|russia|egypt|nigeria|kenya|south africa|uae|saudi arabia|qatar)\b|[,\s](?:AB|BC|MB|NB|NL|NS|NT|NU|ON|PE|QC|SK|YT)(?:[,\s]|$)/i;
const SINGLE_STATE_METRO=new Map(Object.values(STATES).flatMap(code=>{const hit=METROS.filter(m=>m.states.includes(code));return hit.length===1?[[code,hit[0].id] as [string,string]]:[]}));
function segments(text:string){return text.split(/\s*(?:\/|;|\||•|·|\n|,?\s+or\s+|\s+and\s+)\s*/i).map(s=>s.trim()).filter(Boolean)}
function stateOf(segment:string){
 // 招聘系统的地点写法五花八门（US-UT-WEST VALLEY CITY、USA-California-San Jose…），取其中第一个有效的州缩写。
 for(const token of segment.split(/[^A-Za-z]+/))if(token.length===2&&STATE_CODES.has(token))return token;
 const lower=segment.toLowerCase();
 for(const [full,abbr] of Object.entries(STATES))if(new RegExp(`(^|[^a-z])${full}([^a-z]|$)`).test(lower))return abbr;
 return '';
}
/** 解析一条地点文本，返回其中识别出的美国城市、州与都会区。 */
export function parseUsLocation(text:string):UsLocation{
 const cities=new Set<string>(),states=new Set<string>(),metros=new Set<string>();let remote=false;
 for(const segment of segments(String(text||''))){
  if(/\bremote\b|work from home|\bvirtual\b|telecommute|anywhere in the (us|united states)|\bwfh\b/i.test(segment))remote=true;
  if(NON_US.test(segment))continue;
  const state=stateOf(segment),lower=' '+segment.toLowerCase().replace(/[.,()\-_]/g,' ').replace(/\s+/g,' ')+' ';
  let matched;
  for(const key of CITY_KEYS){
   if(!lower.includes(' '+key+' '))continue;
   const options=CITY_INDEX.get(key)!;
   matched=(state&&options.find(o=>o.state===state))||(options.length===1&&(!state||options[0].state===state)?options[0]:undefined);
   if(matched)break;
  }
  if(matched){cities.add(matched.id);states.add(matched.state);metros.add(matched.metro)}
  else if(state){states.add(state);metros.add(SINGLE_STATE_METRO.get(state)||'other-us')}
 }
 if(!metros.size&&remote)metros.add('other-us');
 return {cities:[...cities],states:[...states],metros:[...metros],remote};
}
/** 打包成可用 LIKE 精确匹配的分隔字段；未识别时为 null。 */
export function locationFields(text:string){
 const p=parseUsLocation(text),pack=(xs:string[])=>xs.length?'|'+xs.join('|')+'|':null;
 return {cities:pack(p.cities),states:pack(p.states),metros:pack(p.metros),remote:p.remote?1:0};
}
