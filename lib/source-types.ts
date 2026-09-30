export type Source={id:string;name:string;type:string;group:string;careerUrl:string;tier?:string;host?:string;tenant?:string;board?:string;appliedFacets?:Record<string,string[]>;usFiltered?:boolean;scope?:string;
 /** Eightfold 招聘站里的公司标识（例如 microsoft.com），与 host 一起定位接口。 */
 domain?:string;
 /** Eightfold 旧版接口（/api/apply/v2）：有的公司没有开通 pcsx 接口（NetApp）。 */
 api?:'v2';
 /** 附加的查询参数，同名可重复，例如 Eightfold 的 filter_job_category、Jibe 的 country。 */
 params?:Record<string,string[]>;
 /** Oracle 招聘云：招聘站编号（siteNumber）与该实例里 United States 地点分面的编号（注册时探测，各实例不同）。 */
 site?:string;usLocation?:string;
 /** 官网岗位链接模板，{id} 换成岗位编号；不填时用平台默认链接（Oracle 有的公司另有品牌域名）。 */
 jobUrl?:string;
 /** 网页类来源（SuccessFactors、Avature）的列表页地址模板，{offset} 换成已翻过的条数；筛选条件写在模板里。 */
 list?:string;
 /** 两次翻页之间至少间隔多少毫秒：照站点 robots.txt 的 crawl-delay。 */
 delay?:number;
 /** node：该站点拒绝 Workers 运行时发出的请求（Apple 见到 CF-Worker 请求头就返回 403），开发环境下改由本机 Node 进程代发。 */
 via?:'node'};
