/* Account deletion is performed only by the authenticated server endpoint. */
(()=>{'use strict';
const $=id=>document.getElementById(id),bridge=()=>window.PICKGO_AUTH_BRIDGE;
let busy=false;
$('deleteAccountForm').addEventListener('submit',async event=>{
 event.preventDefault();if(busy)return;
 const user=bridge()?.getUser(),db=bridge()?.getClient(),status=$('deleteAccountStatus');
 if(!user||!db){status.textContent='로그인 후 이용해 주세요.';return}
 if($('deleteAccountConfirm').value.trim()!=='탈퇴'){status.textContent='확인란에 탈퇴를 입력해 주세요.';return}
 if(!window.confirm('회원탈퇴를 진행할까요? 주최한 모집이 취소되고 계정을 복구할 수 없습니다.'))return;
 busy=true;$('deleteAccountSubmit').disabled=true;status.textContent='회원탈퇴를 처리하는 중…';
 try{
  const {data,error}=await db.functions.invoke('pickgo-delete-account',{body:{confirmation:'탈퇴'}});
  if(error){let message='탈퇴를 완료하지 못했습니다. 잠시 후 다시 시도해 주세요.';try{const details=await error.context?.json();if(details?.code==='reauth_required')message='안전을 위해 로그아웃한 뒤 다시 로그인하고 탈퇴를 진행해 주세요.';else if(details?.code==='admin_account')message='관리자 계정은 운영 권한을 정리한 후 탈퇴할 수 있습니다.';else if(details?.code==='delete_failed')message='계정 정보를 정리하지 못했습니다. 계정은 유지됩니다. 운영자에게 문의해 주세요.';}catch{}throw new Error(message)}
  if(data?.deleted!==true)throw new Error('탈퇴 결과를 확인하지 못했습니다. 다시 로그인해 계정 상태를 확인해 주세요.');
  status.textContent='회원탈퇴가 완료되었습니다.';
  await db.auth.signOut({scope:'local'});window.PICKGO_AUTH_UI?.render(null);
  $('memberDialog').close();window.PICKGO_NAVIGATE?.('home');
 }catch(error){status.textContent=error.message||'탈퇴를 완료하지 못했습니다.'}
 finally{busy=false;$('deleteAccountSubmit').disabled=false;$('deleteAccountConfirm').value=''}
});
})();
