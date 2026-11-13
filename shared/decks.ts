import type {Deck} from '../src/deck-model.js';
export interface SharedDeckInput {title:string;description:string;season:string;squadDescriptions:string[];deck:Deck}
export interface SharedDeckPost extends SharedDeckInput {id:string;authorId:string;authorName:string;createdAt:string;upvotes:number;downvotes:number;myVote:number;badgeIds:string[]}
