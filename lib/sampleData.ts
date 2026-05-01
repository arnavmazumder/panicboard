export const sampleSyllabusText = `BIO 142: Human Biology - Spring sprint
Professor Rivera says Canvas has the official dates, but this is the messy version from the syllabus and announcement thread. Lab safety quiz due May 1 at 11:59 PM. Homework 4 on cell signaling is due May 3. Reading: chapters 7 and 8 should be finished before Monday's discussion. Midterm 2 is Wednesday May 7 in class and covers lectures 9-14. Group project proposal deadline May 10 by noon. Final project presentations happen during the week of May 26; exact order TBD.

CS 210: Data Structures
Project 2 checkpoint due 5/2. Submit HW5 by Friday May 9. Quiz on graph search May 6. Read the Dijkstra handout before lab. Final project demo slots are in the last week of class.

HIST 88: Modern Cities
Primary source discussion post due tomorrow. Paper thesis and bibliography due May 12. Museum reflection due May 15. Final exam date listed as TBA by registrar.

PSY 31 weekly email
Research participation credit deadline May 4. Quiz 3 opens May 5 and closes May 7. Short reflection due next class.`;

export const cse452CalendarUrl = "https://courses.cs.washington.edu/courses/cse452/26sp/calendar/calendar.html";

export const cse452CalendarSampleText = `CSE 452: Distributed Systems, Spring 2026 schedule
Source URL: ${cse452CalendarUrl}
April 6: Partner Form due at 17:00.
April 8: Problem set 1 due at 23:59 on Gradescope. Lab 1 and Lab 1 design doc due at 23:59.
April 10: Reading: Lamport, Time, clocks, and the Ordering of Events.
April 17: Problem set 2 due at 23:59. Lab 2 design doc due at 23:59.
April 24: Lab 2 due at 23:59.
April 28: Problem set 3 due at 23:59.
May 4: Problem set 4 due at 23:59. Lab 3 design doc due at 23:59.
May 6: Lab 2 design doc revision due at 23:59 for W credit only.
May 15: Lab 3 due at 23:59. Problem Set 5 due at 23:59.
May 21: Lab 4 part 2 design workshop.
May 28: Lab 4 office hours.
June 4: Section: Lab 4 part 3.`;

export const sampleInputs = [
  {
    name: "Chaotic syllabus paragraph",
    text: sampleSyllabusText
  },
  {
    name: "Exam-heavy course",
    text: "CHEM 201: Quiz 4 due May 2. Midterm exam May 8. Lab report due May 11. Cumulative final exam TBA."
  },
  {
    name: "Ambiguous dates without due dates",
    text: "Design critique slides are due next class. Reading response due after guest lecture. Final portfolio due during finals week."
  }
];
