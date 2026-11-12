/** A representative may manage a channel only after joining it explicitly.
 *  The same server-side rule applies to notices, polls and lectures.
 */
export async function canRepresentativeManageChannel(actor,channelId,query){
 if(actor?.role!=='representative'||!actor.id||!channelId)return false;
 const {rowCount}=await query('SELECT 1 FROM memberships WHERE user_id=$1 AND channel_id=$2',[actor.id,channelId]);
 return rowCount>0;
}
