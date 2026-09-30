import { BlogModel } from "../models/BlogModel.mjs";
import { UsersModel } from "../models/UsersModel.mjs";

// Funny gym-member blog posts (title, body), used to seed the blog table.
const BLOG_POSTS = [
  [
    "I Survived Leg Day",
    "Woke up today and my legs filed for divorce. 10/10 would still skip the stairs at work.",
  ],
  [
    "The Locker Combination Incident",
    "Spent 20 minutes trying to open someone else's locker before realizing mine was one row over. Cardio achieved before I even touched a treadmill.",
  ],
  [
    "Protein Shake or Punishment?",
    "Tried a new protein powder that tastes like chalk and regret. My gains thank me, my taste buds have filed a formal complaint.",
  ],
  [
    "The Mirror Doesn't Lie, But My Playlist Does",
    "Nothing hits different than doing bicep curls to a Disney soundtrack because you forgot your headphones were still connected to the kids' tablet.",
  ],
  [
    "Squat Rack Etiquette 101",
    "PSA: 'working in' does not mean staring at me while I catch my breath for four minutes. We are not the same.",
  ],
  [
    "I Wore My Shirt Inside Out for the Whole Session",
    "Nobody told me. Everybody saw. The tag said 'front' and I still got it wrong.",
  ],
  [
    "Cardio Bunny Confessions",
    "Did 45 minutes on the elliptical while mentally redecorating my apartment. Zero calories burned in my imagination, sadly.",
  ],
  [
    "The Great Water Bottle Mix-Up",
    "Drank from a stranger's bottle by accident. We made eye contact. Neither of us said anything. We are bonded for life now.",
  ],
  [
    "Gym Selfie, Take 47",
    "Turns out 'good lighting by the squat rack' is code for 'blocking three people mid-set.' Sorry, not sorry, the angle was perfect.",
  ],
  [
    "Why Is the Treadmill Always Broken When I Need It",
    "Every single one. Every single time. I'm starting to think they can sense my presence and shut down out of fear.",
  ],
  [
    "My Pre-Workout Gave Me Main Character Energy",
    "Felt like I could deadlift a car. Could not, in fact, deadlift a car. Could barely deadlift my gym bag afterwards.",
  ],
  [
    "The Sock Situation",
    "Wore two different socks to leg day. One had a hole. Genuinely unsure which one, but my dignity definitely does now.",
  ],
  [
    "Group Class Survivor: Day 1",
    "The instructor said 'just one more' four times. I have never trusted anyone less in my entire life.",
  ],
  [
    "Accidentally Made Eye Contact in the Mirror Mid-Grunt",
    "There is no recovering from that. I have already changed gyms in my mind.",
  ],
  [
    "The Sacred Ritual of the Pre-Workout Playlist",
    "Spent 25 minutes curating the perfect playlist. Worked out for 12. Priorities are clearly in order.",
  ],
  [
    "I Tried the 5am Class",
    "Discovered a secret society of people who are somehow both awake and cheerful before sunrise. I do not trust them, but I respect them.",
  ],
  [
    "Forgot My Gym Card Again",
    "The front desk knows my name, my face, and apparently my entire membership history by heart at this point. We're basically family.",
  ],
  [
    "The Bench Press Wobble",
    "Racked the bar like a newborn deer learning to walk. The spotter's face said everything my ego needed to hear.",
  ],
  [
    "My Gym Bag Has Become a Biohazard",
    "Found a banana peel from what I can only assume was a previous geological era. Send help, or at least a scented candle.",
  ],
  [
    "Leg Press Machine vs. My Dignity",
    "Loaded way too many plates to impress absolutely nobody, and now I understand true fear.",
  ],
  [
    "The Great Deadlift Grunt Debate",
    "Is it a war cry or a cry for help? Honestly at this point in my set, both.",
  ],
  [
    "I Made a Gym Friend and I Don't Even Know Their Name",
    "We nod at each other by the water fountain. It's a whole relationship at this point, no names needed.",
  ],
  [
    "Tried Yoga After Only Ever Lifting Weights",
    "Turns out flexibility and strength are not the same skill. My hamstrings filed a restraining order against 'downward dog.'",
  ],
  [
    "The Mysterious Case of the Missing Dumbbell",
    "The 12.5kg dumbbells vanish the second I need them. I'm convinced they're plotting something in the storage room.",
  ],
  [
    "Post-Workout Hunger Is a Personality Trait Now",
    "Burned 300 calories, ate 1200 in celebration. The math checks out somewhere, probably.",
  ],
  [
    "My Trainer Said 'Just Breathe' and I Forgot How",
    "Apparently inhaling and exhaling gets complicated under a barbell. Who knew.",
  ],
  [
    "The Treadmill Incline Betrayal",
    "Set it to 'hill workout' expecting a gentle slope. Ended up training for a mountain rescue mission instead.",
  ],
  [
    "Gym Mirror Selfie Fail",
    "Took twelve photos to get one where I don't look like I'm mid-sneeze. Success rate: unacceptable.",
  ],
  [
    "I Wore Jeans to the Gym Once",
    "Once. That is the whole story. I still hear the squeaking sounds in my nightmares.",
  ],
  [
    "The Suspicious Silence of the Sauna",
    "Everyone just sits there in silence sweating like it's a competitive sport. I respect the commitment.",
  ],
  [
    "My Gym Playlist Betrayed Me Mid-Squat",
    "Song switched to a slow ballad right as I hit the bottom of my squat. Nearly gave up on life and gravity simultaneously.",
  ],
  [
    "The Great Chalk Explosion of Tuesday",
    "Clapped my hands before a lift and created a small dust storm. The people two racks over are still coughing.",
  ],
  [
    "I Tried Intermittent Fasting Before Leg Day",
    "Big mistake. Huge. Nearly fainted into the squat rack and made new friends on the way down.",
  ],
  [
    "Gym Etiquette: Re-Rack Your Weights, Please",
    "Found someone's entire workout still sitting on the bar like an abandoned art installation. Sir. Ma'am. Please.",
  ],
  [
    "The Cardio Machine That Judges Me",
    "The screen said 'fat burn zone' in a tone I did not appreciate. We are no longer on speaking terms.",
  ],
  [
    "I Accidentally Joined a Spin Class",
    "Thought it was a normal cycling machine. Forty-five minutes later I emerged a changed, sweatier person.",
  ],
  [
    "The Water Fountain Line Is Longer Than the Squat Rack Line",
    "Says a lot about our priorities as a species, honestly.",
  ],
  [
    "My Gym Shoes Have Their Own Smell Now",
    "It has evolved past 'odor' into something closer to a sentient being. We've named it Gary.",
  ],
  [
    "The Day I Confused Cable Machines",
    "Tried to do a bicep curl and accidentally activated what I can only describe as a medieval torture device.",
  ],
  [
    "Post-Gym Nap Is a Human Right",
    "Worked out for one hour, slept for three. The math is irrelevant when you've earned it.",
  ],
];

const buildCreatedTimestamp = (dayOffset) => {
  const date = new Date();
  date.setDate(date.getDate() - dayOffset);
  date.setHours(
    8 + Math.floor(Math.random() * 12),
    Math.floor(Math.random() * 60),
    0,
    0,
  );
  return date.toISOString().slice(0, 19).replace("T", " ");
};

const seedBlogPosts = async () => {
  const users = await UsersModel.getAll();
  const members = users.filter((user) => user.role === "member");
  if (members.length === 0) {
    throw new Error(
      "No member users found to author blog posts. Seed members first.",
    );
  }

  for (const [index, [title, content]] of BLOG_POSTS.entries()) {
    const dayOffset = 21 - Math.round((index * 21) / (BLOG_POSTS.length - 1));
    const author = members[Math.floor(Math.random() * members.length)];
    const blog = new BlogModel(
      null,
      title,
      content,
      author.id,
      buildCreatedTimestamp(dayOffset),
      0,
      author.id,
    );
    await BlogModel.create(blog);
  }
  console.log(`Seeded ${BLOG_POSTS.length} blog posts.`);
  await UsersModel.connection.end();
};

seedBlogPosts().catch((error) => {
  console.error("Failed to seed blog posts:", error);
  process.exitCode = 1;
});
