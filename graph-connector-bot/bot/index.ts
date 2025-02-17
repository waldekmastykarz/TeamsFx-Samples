// Import required packages
import * as path from "path";
import * as restify from "restify";

// Import required bot services.
// See https://aka.ms/bot-services to learn more about the different parts of a bot.
import {
  BotFrameworkAdapter,
  TurnContext,
} from "botbuilder";

// This bot's main dialog.
import { TeamsBot } from "./teamsBot";
import { SSODialog } from "./helpers/ssoDialog";
import { NotificationHandler } from "./services/notificationHandler";

// Create adapter.
// See https://aka.ms/about-bot-adapter to learn more about adapters.
const adapter = new BotFrameworkAdapter({
  appId: process.env.BOT_ID,
  appPassword: process.env.BOT_PASSWORD,
});

// Catch-all for errors.
const onTurnErrorHandler = async (context: TurnContext, error: Error) => {
  // This check writes out errors to console log .vs. app insights.
  // NOTE: In production environment, you should consider logging this to Azure
  //       application insights.
  console.error(`\n [onTurnError] unhandled error: ${error}`);

  // Send a trace activity, which will be displayed in Bot Framework Emulator
  await context.sendTraceActivity(
    "OnTurnError Trace",
    `${error}`,
    "https://www.botframework.com/schemas/error",
    "TurnError"
  );

  // Send a message to the user
  await context.sendActivity(`The bot encountered unhandled error:\n ${error.message}`);
  await context.sendActivity("To continue to run this bot, please fix the bot source code.");
};

// Set the onTurnError for the singleton BotFrameworkAdapter.
adapter.onTurnError = onTurnErrorHandler;



// Create the bot that will handle incoming messages.
const bot = new TeamsBot();

// Create HTTP server.
const server = restify.createServer();
server.listen(process.env.port || process.env.PORT || 3978, () => {
  console.log(`\nBot Started, ${server.name} listening to ${server.url}`);
});
server.use(restify.plugins.bodyParser());

// Listen for incoming requests.
server.post("/api/messages", async (req, res) => {
  await adapter
    .processActivity(req, res, async (context) => {
      await bot.run(context);
    })
    .catch((err) => {
      // Error message including "412" means it is waiting for user's consent, which is a normal process of SSO, sholdn't throw this error.
      if (!err.message.includes("412")) {
        throw err;
      }
    });
});

server.post("/api/notification", async (req, res) => {
  // By design to not use 'await' in order to immediately return an HTTP 202 and process webhook notification in background.
  NotificationHandler.processGraphWebhookChangeNotification(req);
  res.send(202);
});

server.get(
  "/auth-*.html",
  restify.plugins.serveStatic({
    directory: path.join(__dirname, "public"),
  })
);
