This is ECHO, a project idea I would like to test here.  
The goal is to create a platform that allows the display and analysis of the communication from a chat-server.  
The source of this analysis will be a .json file that contains a structure with channels, and within those individual messages. Sender, timestamp (UTC) and message context are stored in there. We will keep it basic for now.  
What I would like to do is create a platform that does the following:

When started, it asks for a .json for analysis. The user can load that from the local filesystem, and some basic information is displayed. A list of channels within the file is collected, the number of active users, and definitely the timeframe this fiel covers. I expect something around two weeks to be normal.  More statistics could be shown here, for example a graph that displays how channels are connected via overlapping users. A circle-based sankey diagram perhaps.

The next screen is primarily a complete list of all messages from the file, in chronological order.  
Each message gets a small border and contains a top line with the timestamp, channel name and name of the sender.  
Beneath that the message is displayed. If space allows it, the message is displayed as-is, linebreaks are introduced when necessary. Scrolling through these message should be fluid. On the left of the screen a panel allows certain filters. Channels can be filtered, a certain time interval can be applied to focus on something.  
At the bottom another panel is visible, containing a timeline. It shows every single message as a small vertical line, and a couple of different options are available:  
Showing a separate timeline for each channel would be preferable, but if the number of channels gets too large, only a selection of them can be shown separately, the others are combined into one. The left-side panel should allow ordering of these channels in addition to filtering, both influencing what is displayed in what way in the timeline.  
What I would also like to see in the timeline is a translucent box in the background that shows which part of the timeline is currently visible in the message panel. And clicking on the timeline should jump the message display to that time, with the clicked point being the new center, not the start. Context is important.

Channels should have individual colors, presented both in the left-side filter, drawing colored borders around the messages and using those for individual timelines in the bottom panel.  

Lastly another thing: Keyword tracking. I want to be able to enter a word or phrase, and have all messages containing that term show up. I am not sure if that is also done of the message screen, or if it should become a separate screen.  They keyword should definitely be highlighted.
What I need to see here is how a certain keyword "flows" through the channels. Who is talking about it, in which channels, and what are the temporal gaps between mentions? I am not entirely sure how to best approach this. And it might also be prudent to not restrict the filters hard to that keyword, but allow the user to see the messages before and/or after a selected one.
Regarding keyword selection. I want to be able to enter a keyword I know to be relevant, but it would also be cool to have a system screen all messages on startup, and build some sort of "word cloud" or some other system that allows me to pre-select keywords that I can later select without having to enter them manually. Grouping of these keywords would also be awesome. Basically being able to say something like "Alpha, Beta, Charlie and Delta are important keywords I want to look at later, and Alpha and Bravo are grouped", and then enter a keyword group name. When looking at the keyword flow later I can also select an entire group instead of a single keyword, and the flow of each keyword is shown individually for comparison. Multiple keywords can of course be selected/entered manually as well.

All of this is a highly technical platform, so I don't want any unnecessary fluff on-screen. No descriptions, explanations of what things do, three header titles. as this will take up a large portition of the physical screen I don't want it to be too bright. maybe more in the gray tones, and have some good colors for the channels and keywords that stand out.

Vue/Vuetify for the frontend work, Python for the backend, with FastAPI bridging the gap. As this is just a demo we don't need anything that stores information across sessions right now.
