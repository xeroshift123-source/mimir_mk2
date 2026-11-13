export interface VoteState{myVote:number;upvotes:number;downvotes:number}
export function previewVote(previous:VoteState,value:number):VoteState{
 const next=previous.myVote===value?0:value;
 return {myVote:next,upvotes:Math.max(0,previous.upvotes-(previous.myVote===1?1:0)+(next===1?1:0)),downvotes:Math.max(0,previous.downvotes-(previous.myVote===-1?1:0)+(next===-1?1:0))};
}
