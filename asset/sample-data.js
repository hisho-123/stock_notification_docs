/* 画面確認専用。外部通信・実際の価格取得・永続保存は行わない。価格は説明用の仮の値。 */
window.stockSample = {
  assets: [
    {id:'1',code:'^GSPC',name:'S&P 500',highest_value:'6000',latest_value:'5100',decline_rate:'15.00',latest_fetched_at:'2026-10-07T22:00:00Z',enabled:true,last_notified_threshold:15,last_checked_at:'2026-10-07T22:00:00Z',last_error_code:null,created_at:'2026-10-01T00:00:00Z',updated_at:'2026-10-07T22:00:00Z'},
    {id:'2',code:'^IXIC',name:'NASDAQ総合指数',highest_value:'20000',latest_value:'18000',decline_rate:'10.00',latest_fetched_at:'2026-10-07T22:00:00Z',enabled:true,last_notified_threshold:10,last_checked_at:'2026-10-07T22:00:00Z',last_error_code:null,created_at:'2026-10-02T00:00:00Z',updated_at:'2026-10-07T22:00:00Z'},
    {id:'3',code:'AAPL',name:'Apple Inc.',highest_value:'250',latest_value:'225',decline_rate:'10.00',latest_fetched_at:'2026-10-06T22:00:00Z',enabled:false,last_notified_threshold:null,last_checked_at:'2026-10-06T22:00:00Z',last_error_code:null,created_at:'2026-10-03T00:00:00Z',updated_at:'2026-10-06T23:00:00Z'},
    {id:'4',code:'NVDA',name:'NVIDIA Corporation',highest_value:'150',latest_value:'148.75',decline_rate:'0.83',latest_fetched_at:'2026-10-06T22:00:00Z',enabled:true,last_notified_threshold:null,last_checked_at:'2026-10-07T22:00:00Z',last_error_code:'PRICE_FETCH_FAILED',created_at:'2026-10-04T00:00:00Z',updated_at:'2026-10-07T22:00:00Z'},
    {id:'5',code:'MSFT',name:'Microsoft Corporation',highest_value:'500',latest_value:'410',decline_rate:'18.00',latest_fetched_at:'2026-10-07T22:00:00Z',enabled:true,last_notified_threshold:15,last_checked_at:'2026-10-07T22:00:00Z',last_error_code:'NOTIFICATION_FAILED',created_at:'2026-10-05T00:00:00Z',updated_at:'2026-10-07T22:00:00Z'}
  ],
  quotes: {'AAPL':{name:'Apple Inc.',price:'225'},'^GSPC':{name:'S&P 500',price:'5100'},'^IXIC':{name:'NASDAQ総合指数',price:'18000'},'NVDA':{name:'NVIDIA Corporation',price:'148.75'},'MSFT':{name:'Microsoft Corporation',price:'410'},'TSLA':{name:'Tesla, Inc.',price:'300'},'^DJI':{name:'ダウ工業株30種平均',price:'42000'},'^N225':{name:'日経平均株価',price:'38000'}},
  settings:{thresholds:[10,15,20,25,30],updated_at:'2026-10-07T22:00:00Z'}
};
