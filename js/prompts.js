// JournalPilot AI — prompt bank: 102 prompts across 6 categories.
// Pure data module, browser + node compatible.
(function () {
"use strict";

const CATEGORIES = ["gratitude", "reflection", "goals", "creativity", "relationships", "selfcare"];

const CATEGORY_LABELS = {
  gratitude: "Gratitude",
  reflection: "Reflection",
  goals: "Goals",
  creativity: "Creativity",
  relationships: "Relationships",
  selfcare: "Self-care"
};

const PROMPTS = {
  gratitude: [
    "What are three small things that went right today?",
    "Who made your day a little better recently, and how?",
    "What is something in your home you are grateful for?",
    "What skill or ability of yours are you thankful to have?",
    "What is a recent challenge that taught you something valuable?",
    "What is your favorite simple pleasure?",
    "What made you smile this week?",
    "What is something you take for granted that others might not have?",
    "What is a past difficulty you are now glad you went through?",
    "What food are you most grateful for today?",
    "What is something beautiful you noticed today?",
    "What part of your body are you thankful for right now?",
    "What opportunity are you grateful to have at this stage of your life?",
    "What is a kind thing someone did for you lately?",
    "What technology makes your life easier that you appreciate?",
    "What memory always makes you feel warm inside?",
    "What is something you are looking forward to?",
    "What is a strength you have that you rarely acknowledge?"
  ],
  reflection: [
    "What did today teach you about yourself?",
    "What would you do differently if you could replay today?",
    "What is weighing on your mind right now?",
    "What are you proud of this week?",
    "Which habit is serving you well, and which one is not?",
    "What does your ideal day look like, in detail?",
    "What fear has been holding you back lately?",
    "What do you need more of in your life right now?",
    "What do you need less of?",
    "When did you last feel truly at peace? What were you doing?",
    "What is a belief you held a year ago that has changed?",
    "What would you tell yourself five years ago?",
    "What drains your energy the most these days?",
    "What restores your energy the fastest?",
    "What is something you have been avoiding, and why?",
    "How have you grown in the last six months?",
    "What does success mean to you right now?",
    "What is one thing you can forgive yourself for today?"
  ],
  goals: [
    "What is one goal you want to make progress on this week?",
    "What is the smallest next step toward your biggest goal?",
    "Where do you want to be one year from today?",
    "What would you attempt if you knew you could not fail?",
    "What is a goal you have been postponing, and what is the real reason?",
    "What new skill would you love to learn this year?",
    "What does your ideal morning routine look like?",
    "What financial goal matters most to you right now?",
    "What is one health goal for this month?",
    "Who do you want to become in the next chapter of your life?",
    "What project would you start with an extra hour each day?",
    "What is a ten-year dream you rarely say out loud?",
    "What milestone will you celebrate next, and how?",
    "What is holding you back from your top goal?",
    "What does progress (not perfection) look like this week?",
    "What commitment can you make to your future self today?",
    "What would your best self do about your current biggest challenge?",
    "What is one thing you want to finish before the month ends?"
  ],
  creativity: [
    "Describe your perfect hideaway in vivid detail.",
    "Write about a door you have never opened. What is behind it?",
    "If your life had a soundtrack today, what three songs would be on it?",
    "Invent a holiday and describe how the world celebrates it.",
    "Write a letter to your future self, ten years from now.",
    "Describe the most interesting stranger you have ever seen.",
    "If you could have dinner with anyone, living or dead, who would it be and why?",
    "Write about a place from your childhood as if it were a mythical kingdom.",
    "What would you do with a completely free Saturday and no obligations?",
    "Describe your dream home, room by room.",
    "Write the opening line of your autobiography.",
    "If you were a color today, which one would you be and why?",
    "Describe a meal that tells the story of your family.",
    "What superpower would make your daily life better, and how would you use it?",
    "Write about the best trip you have ever taken, moment by moment.",
    "Invent a small tradition you wish your family had.",
    "Describe the sky right now without using the words blue or gray.",
    "What story will you tell about this year when you are old?"
  ],
  relationships: [
    "Who in your life deserves more of your time?",
    "What friend have you been meaning to reach out to?",
    "What do you appreciate most about your closest friend?",
    "How do you show love to the people around you?",
    "What is a relationship you want to repair or strengthen?",
    "Who taught you the most about kindness?",
    "What does quality time look like to you?",
    "How have your friendships changed as you have grown older?",
    "What boundaries do you need to set or keep in a relationship?",
    "Who makes you laugh the hardest, and when was the last time?",
    "What is something you want to thank a family member for?",
    "How do you want people to feel after spending time with you?",
    "What community do you feel most at home in?",
    "Who believed in you when you did not believe in yourself?",
    "What is one kind thing you can do for someone this week?"
  ],
  selfcare: [
    "How is your body feeling today, honestly?",
    "What does rest look like for you, apart from sleep?",
    "What is one small way you can be kinder to yourself today?",
    "When did you last do something purely for fun?",
    "What helps you calm down when you feel overwhelmed?",
    "Do you truly allow yourself to rest? Why or why not?",
    "What would a perfect self-care evening include?",
    "What is one unhealthy pattern you are ready to release?",
    "How much water, movement, and fresh air did you get today?",
    "What is something your body is asking for right now?",
    "What routine helps you feel most like yourself?",
    "What is one thing you can do tonight to help tomorrow-you?",
    "How do you recharge after a socially draining day?",
    "What small luxury is worth it to you?",
    "What does enough look like for today?"
  ]
};

function promptCount() {
  return CATEGORIES.reduce(function (n, c) { return n + PROMPTS[c].length; }, 0);
}

const api = { CATEGORIES: CATEGORIES, CATEGORY_LABELS: CATEGORY_LABELS, PROMPTS: PROMPTS, promptCount: promptCount };

if (typeof window !== "undefined") window.JournalPrompts = api;
if (typeof module !== "undefined" && module.exports) module.exports = api;
})();
