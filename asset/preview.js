/* HTML画面イメージ用の操作。API呼び出し・認証・永続化は行わない。 */
(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  const state = $('preview-state');
  const clone = value => JSON.parse(JSON.stringify(value));
  const show = (id, text) => { const node = $(id); node.textContent = text; node.hidden = !text; };
  const date = value => {
    const parts = new Intl.DateTimeFormat('ja-JP', {timeZone:'Asia/Tokyo',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).formatToParts(new Date(value));
    const p = Object.fromEntries(parts.map(x => [x.type,x.value]));
    return `${p.year}/${p.month}/${p.day} ${p.hour}:${p.minute}`;
  };
  const price = value => { const [whole,fraction] = value.split('.'); return whole.replace(/\B(?=(\d{3})+(?!\d))/g,',') + (fraction ? '.'+fraction : ''); };
  const button = (text, action, css = '') => { const b = document.createElement('button'); b.type='button'; b.textContent=text; b.className=css; b.addEventListener('click',action); return b; };
  const cell = (row, text, css = '') => { const td = document.createElement('td'); td.className=css; if (text !== null) td.textContent=text; row.append(td); return td; };
  // 十進数の文字列を精度を落とさず比較する。画面確認用ソートでも数値順を使用。
  const decimal = value => { const [w,f=''] = String(value).split('.'); return {n:BigInt(w+f),d:10n ** BigInt(f.length)}; };
  const compareDecimal = (a,b) => { const x=decimal(a),y=decimal(b),v=x.n*y.d-y.n*x.d; return v < 0n ? -1 : v > 0n ? 1 : 0; };
  const decline = asset => { const h=decimal(asset.highest_value),p=decimal(asset.latest_value); return {n:h.n*p.d-p.n*h.d,d:h.n*p.d}; };
  const compareDecline = (a,b) => { const x=decline(a),y=decline(b),v=x.n*y.d-y.n*x.d; return v < 0n ? -1 : v > 0n ? 1 : 0; };

  function loginPage() {
    const form=$('login-form'), id=$('admin-id'), password=$('password'), submit=$('login-button');
    function render() {
      const sending=state.value==='sending', limited=state.value==='limited';
      id.disabled=password.disabled=sending; submit.disabled=sending||limited;
      submit.textContent=sending?'ログイン中…':'ログイン';
      show('login-status',sending?'ログインしています…':'');
      const errors={'auth-error':'IDまたはパスワードが違います。','network-error':'通信に失敗しました。接続を確認して再試行してください。',limited:'ログインの試行回数が上限に達しました。15分後に再試行してください。'};
      show('login-error',errors[state.value]||'');
      id.removeAttribute('aria-invalid');password.removeAttribute('aria-invalid');
      if (errors[state.value]) password.value='';
    }
    state.addEventListener('change',render);
    form.addEventListener('submit',event => {
      event.preventDefault(); if(submit.disabled) return;
      const badId=!id.value, badPassword=!password.value || new TextEncoder().encode(password.value).length>72;
      id.setAttribute('aria-invalid',String(badId));password.setAttribute('aria-invalid',String(badPassword));
      if(badId||badPassword){show('login-error','IDとパスワードを入力してください。パスワードは72バイト以下です。');(badId?id:password).focus();return;}
      if(state.value!=='normal'){password.value='';render();return;}
      state.value='sending';render();setTimeout(()=>location.href='assets.html',350);
    });render();
  }

  function assetsPage() {
    let items=clone(window.stockSample.assets), query='', sort='created_at', order='asc', nextId=7, pending=null, deleteId=null, opener=null;
    const region=$('table-region'), body=$('asset-rows'), dialog=$('delete-dialog');
    const errorLabels={PRICE_FETCH_FAILED:'価格取得に失敗',NOTIFICATION_FAILED:'LINE通知に失敗',PRICE_DATA_STALE:'価格データが10日以上前'};
    function notice(text){show('notice',text);}
    function sorted() {
      const q=query.toLocaleLowerCase('ja');
      return items.filter(a=>[a.code,a.name].some(s=>s.toLocaleLowerCase('ja').includes(q))).sort((a,b)=>{
        const x=a[sort],y=b[sort];
        if(x===null||y===null){if(x!==y)return x===null?1:-1;}
        let v=0;
        if(sort==='decline_rate')v=compareDecline(a,b);
        else if(['highest_value','latest_value','last_notified_threshold'].includes(sort) && x!==null && y!==null)v=compareDecimal(x,y);
        else if(sort==='enabled')v=Number(x)-Number(y);
        else if(x!==null&&y!==null)v=String(x).localeCompare(String(y),'ja');
        if(v)return order==='asc'?v:-v;
        return BigInt(a.id)<BigInt(b.id)?-1:BigInt(a.id)>BigInt(b.id)?1:0;
      });
    }
    function render() {
      const loading=state.value==='loading', adding=state.value==='adding'||pending==='add';
      const rows=state.value==='no-results'?[]:sorted();
      $('code-input').disabled=$('add-button').disabled=adding||loading;
      $('add-button').textContent=adding?'取得中…':'＋ 追加';
      for(const id of ['search-input','search-button','sort-select','order-button','refresh-button'])$(id).disabled=loading;
      $('sort-select').value=sort; $('order-button').textContent=order==='asc'?'昇順 ↑':'降順 ↓';
      $('order-button').setAttribute('aria-label',order==='asc'?'並び順を降順に変更':'並び順を昇順に変更');
      const count=$('result-count');count.replaceChildren();const strong=document.createElement('strong');strong.textContent=loading?'—':String(rows.length);count.append(strong,document.createTextNode('件の監視対象'));
      show('list-error',state.value==='network-error'?'一覧を更新できませんでした。直前の一覧を表示しています。「一覧更新」で再試行できます。':'');
      const status=$('list-status');status.hidden=!loading;status.replaceChildren();if(loading){const s=document.createElement('span');s.className='spinner';s.setAttribute('aria-hidden','true');status.append(s,'監視対象を読み込んでいます…');}
      const empty=$('empty-state');empty.hidden=loading||rows.length>0;empty.replaceChildren();
      if(!empty.hidden){const h=document.createElement('h2'),p=document.createElement('p');h.textContent=items.length===0?'監視対象がまだありません':'一致する監視対象がありません';p.textContent=items.length===0?'銘柄コードを入力して、最初の株・指数を追加してください。':'検索語を変更するか、空欄で検索して絞り込みを解除してください。';empty.append(h,p);}
      region.hidden=loading||rows.length===0;body.replaceChildren();
      for(const asset of rows) {
        const row=document.createElement('tr');row.dataset.id=asset.id;
        const info=cell(row,null);const code=document.createElement('div');code.className='asset-code';code.textContent=asset.code;const name=document.createElement('div');name.className='asset-name';name.textContent=asset.name;info.append(code,name);
        if(asset.last_error_code){const error=document.createElement('div');error.className='row-error';error.textContent=errorLabels[asset.last_error_code]+' · 確認 '+date(asset.last_checked_at)+' JST';info.append(error);}
        cell(row,price(asset.highest_value),'num price');cell(row,price(asset.latest_value),'num price');cell(row,asset.decline_rate+'%','num loss');
        const stamp=cell(row,null,'date');stamp.append(document.createTextNode(date(asset.latest_fetched_at)),document.createElement('br'),document.createTextNode('JST'));
        const statusCell=cell(row,null);const badge=document.createElement('span');badge.className='badge '+(asset.enabled?'active':'paused');badge.textContent=asset.enabled?'監視中':'停止中';statusCell.append(badge);
        cell(row,asset.last_notified_threshold===null?'未通知':asset.last_notified_threshold+'%','num');
        const action=cell(row,null), actions=document.createElement('div');actions.className='actions';
        const toggle=button(asset.enabled?'停止':'再開',()=>{
          if(pending)return;pending=asset.id;render();
          setTimeout(()=>{asset.enabled=!asset.enabled;asset.updated_at=new Date().toISOString();pending=null;render();notice(`${asset.code}の監視を${asset.enabled?'再開':'停止'}しました。最高値と通知済み状態は保持されます。`);const current=body.querySelector(`tr[data-id="${asset.id}"] button`);if(current)current.focus();},250);
        });toggle.setAttribute('aria-label',`${asset.code}の監視を${asset.enabled?'停止':'再開'}`);
        const remove=button('削除',event=>{opener=event.currentTarget;deleteId=asset.id;$('delete-target').textContent=`${asset.code} · ${asset.name}`;show('delete-error','');dialog.showModal();$('delete-cancel').focus();},'danger');remove.setAttribute('aria-label',`${asset.code}を削除`);
        toggle.disabled=remove.disabled=!!pending;actions.append(toggle,remove);action.append(actions);body.append(row);
      }
      for(const th of document.querySelectorAll('th[data-sort]'))th.setAttribute('aria-sort',th.dataset.sort===sort?(order==='asc'?'ascending':'descending'):'none');
    }
    state.addEventListener('change',()=>{items=clone(window.stockSample.assets);query='';$('search-input').value='';pending=null;$('preview-stale-registration').checked=false;show('add-error','');notice('');if(state.value==='empty')items=[];if(state.value==='no-results'){$('search-input').value=query='存在しない銘柄';}render();});
    $('add-form').addEventListener('submit',event=>{
      event.preventDefault();if($('add-button').disabled)return;
      const code=$('code-input').value.trim().replace(/[a-z]/g,s=>s.toUpperCase());
      let error='';if(!code||[...code].length>64||/[\s\u0000-\u001f\u007f]/u.test(code))error='銘柄コードは空白を含まない1〜64文字で入力してください。';
      else if(items.some(a=>a.code===code))error='この銘柄は登録済みです。';
      else if(!Object.hasOwn(window.stockSample.quotes,code))error='この画面イメージのサンプルにないコードです。TSLA、^DJI、^N225をお試しください。';
      $('code-input').setAttribute('aria-invalid',String(!!error));show('add-error',error);if(error){$('code-input').focus();return;}
      state.value='normal';pending='add';render();setTimeout(()=>{const quote=window.stockSample.quotes[code],now=new Date().toISOString(),stale=$('preview-stale-registration').checked;items.push({id:String(nextId++),code,name:quote.name,highest_value:quote.price,latest_value:quote.price,decline_rate:'0.00',latest_fetched_at:now,enabled:!stale,last_notified_threshold:null,last_checked_at:now,last_error_code:stale?'PRICE_DATA_STALE':null,created_at:now,updated_at:now});$('code-input').value='';pending=null;render();notice(stale?`${code}を追加しました。価格データが10日以上前のため、停止状態で登録しました。`:`${code}を追加しました。登録時の価格から監視を開始します。`);$('code-input').focus();},400);
    });
    $('search-form').addEventListener('submit',event=>{event.preventDefault();if(event.isComposing||event.keyCode===229)return;query=$('search-input').value.trim();state.value='normal';render();});
    $('search-input').addEventListener('keydown',event=>{if(event.key==='Enter'&&event.isComposing)event.preventDefault();});
    $('sort-select').addEventListener('change',()=>{sort=$('sort-select').value;order='asc';render();});
    $('order-button').addEventListener('click',()=>{order=order==='asc'?'desc':'asc';render();});
    for(const th of document.querySelectorAll('th[data-sort]'))th.querySelector('button').addEventListener('click',()=>{if(sort===th.dataset.sort)order=order==='asc'?'desc':'asc';else{sort=th.dataset.sort;order='asc';}render();});
    $('refresh-button').addEventListener('click',()=>{state.value='normal';render();notice('保存された一覧を更新しました。価格の再取得は行いません。');});
    $('delete-cancel').addEventListener('click',()=>dialog.close());
    dialog.addEventListener('close',()=>{if(opener&&opener.isConnected)opener.focus();else $('code-input').focus();});
    $('delete-confirm').addEventListener('click',()=>{const asset=items.find(a=>a.id===deleteId);if(!asset)return;items=items.filter(a=>a.id!==deleteId);dialog.close();render();notice(`${asset.code}を削除しました。`);$('code-input').focus();});
    $('logout-button').addEventListener('click',()=>location.href='login.html');render();
  }

  function settingsPage() {
    let saved=clone(window.stockSample.settings.thresholds),edited=[...saved],updated=window.stockSample.settings.updated_at,busy=false,destination='assets.html';
    const dialog=$('discard-dialog');
    const dirty=()=>JSON.stringify(saved)!==JSON.stringify(edited);
    function confirmLeave(target) {
      destination=target;
      if(!dirty())return true;
      const logout=destination==='login.html';
      $('discard-description').textContent=logout?'変更を破棄してログアウトしますか？':'変更を破棄して監視対象の一覧へ戻りますか？';
      $('discard-confirm').textContent=logout?'破棄してログアウト':'破棄して戻る';
      dialog.showModal();$('discard-cancel').focus();return false;
    }
    function render() {
      const loading=state.value==='loading', failed=state.value==='load-error', saving=state.value==='saving'||busy;
      const locked=loading||failed||saving;
      $('threshold-input').disabled=$('threshold-add-button').disabled=locked;
      $('save-button').disabled=locked||!dirty()||edited.length===0;
      $('save-button').textContent=saving?'保存中…':'設定を保存';
      $('updated-at').textContent=loading||failed?'':'更新：'+date(updated)+' JST';
      $('retry-button').hidden=!failed;
      show('settings-status',loading?'通知設定を読み込んでいます…':saving?'設定を保存しています…':state.value==='saved'?'設定を保存しました。次の監視実行から適用されます。':dirty()?'未保存の変更があります。':'');
      show('settings-error',failed?'設定を取得できませんでした。「再試行」で読み込み直してください。':state.value==='save-error'?'保存に失敗しました。編集中の値を保持しています。もう一度保存してください。':'');
      const list=$('threshold-list');list.replaceChildren();
      if(loading||failed)return;
      if(edited.length===0){const empty=document.createElement('p');empty.className='small muted';empty.textContent='通知率を1件以上追加してください。';list.append(empty);}
      for(const value of edited){const chip=document.createElement('span');chip.className='threshold';chip.append(document.createTextNode(value+'%'));const remove=button('×',()=>{edited=edited.filter(t=>t!==value);render();$('threshold-input').focus();});remove.setAttribute('aria-label',`${value}%を削除`);remove.disabled=locked;chip.append(remove);list.append(chip);}
    }
    state.addEventListener('change',()=>{saved=clone(window.stockSample.settings.thresholds);edited=[...saved];updated=window.stockSample.settings.updated_at;busy=false;if(['saving','save-error'].includes(state.value))edited.push(35);render();});
    $('threshold-add-form').addEventListener('submit',event=>{
      event.preventDefault();if($('threshold-input').disabled)return;const raw=$('threshold-input').value,number=Number(raw);
      let error='';if(!/^\d+$/.test(raw)||number<1||number>99)error='1〜99の整数を入力してください。';else if(edited.includes(number))error='この通知率は追加済みです。';
      $('threshold-input').setAttribute('aria-invalid',String(!!error));if(error){show('settings-error',error);$('threshold-input').focus();return;}
      edited.push(number);edited.sort((a,b)=>a-b);$('threshold-input').value='';render();$('threshold-input').focus();
    });
    $('settings-form').addEventListener('submit',event=>{
      event.preventDefault();if($('save-button').disabled)return;busy=true;render();setTimeout(()=>{saved=[...edited];updated=new Date().toISOString();busy=false;state.value='saved';render();},350);
    });
    $('retry-button').addEventListener('click',()=>{state.value='normal';render();});
    for(const link of document.querySelectorAll('[data-leave]'))link.addEventListener('click',event=>{if(!confirmLeave(link.getAttribute('href')))event.preventDefault();});
    $('logout-button').addEventListener('click',()=>{if(confirmLeave('login.html'))location.href=destination;});
    $('discard-cancel').addEventListener('click',()=>dialog.close());
    $('discard-confirm').addEventListener('click',()=>{saved=[...edited];location.href=destination;});
    window.addEventListener('beforeunload',event=>{if(dirty()){event.preventDefault();event.returnValue='';}});render();
  }
  ({login:loginPage,assets:assetsPage,settings:settingsPage})[document.body.dataset.page]?.();
})();
