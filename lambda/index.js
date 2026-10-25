const Alexa = require('ask-sdk-core');

const MAX_RETRIES = 5;

const STREAM = {
  // Alexa plays only HTTPS streams with a trusted certificate,
  // so we use the TLS port 8443 instead of http://mds-station.com:8000/mds
  url: 'https://mds-station.com:8443/mds',
  metadata: {
    title: 'MDS Station',
    subtitle: 'Model dlya sborki',
  },
};

// Every play needs a unique token: Alexa ignores an ENQUEUE that repeats
// the current token. The retry counter travels inside the token.
const makeToken = (retry = 0) => `mds-${Date.now()}-r${retry}`;
const retryOf = (token) => Number((/-r(\d+)$/.exec(token || '') || [])[1] || 0);

function play(handlerInput, speech, token = makeToken()) {
  const builder = handlerInput.responseBuilder;
  if (speech) builder.speak(speech);
  return builder
    .addAudioPlayerPlayDirective('REPLACE_ALL', STREAM.url, token, 0, null, STREAM.metadata)
    .withShouldEndSession(true)
    .getResponse();
}

function stop(handlerInput) {
  return handlerInput.responseBuilder
    .addAudioPlayerClearQueueDirective('CLEAR_ALL')
    .addAudioPlayerStopDirective()
    .withShouldEndSession(true)
    .getResponse();
}

const isIntent = (input, ...names) =>
  Alexa.getRequestType(input.requestEnvelope) === 'IntentRequest' &&
  names.includes(Alexa.getIntentName(input.requestEnvelope));

const LaunchAndPlayHandler = {
  canHandle(input) {
    const type = Alexa.getRequestType(input.requestEnvelope);
    return type === 'LaunchRequest' ||
      isIntent(input, 'PlayRadioIntent', 'AMAZON.ResumeIntent', 'AMAZON.StartOverIntent') ||
      type === 'PlaybackController.PlayCommandIssued';
  },
  handle(input) {
    const type = Alexa.getRequestType(input.requestEnvelope);
    // PlaybackController requests (device buttons) must not contain speech
    const speech = type === 'LaunchRequest' || isIntent(input, 'PlayRadioIntent') ? 'Playing MDS Station.' : null;
    return play(input, speech);
  },
};

const PauseStopHandler = {
  canHandle(input) {
    const type = Alexa.getRequestType(input.requestEnvelope);
    return isIntent(input, 'AMAZON.PauseIntent', 'AMAZON.StopIntent', 'AMAZON.CancelIntent') ||
      type === 'PlaybackController.PauseCommandIssued';
  },
  handle(input) {
    return stop(input);
  },
};

const HelpHandler = {
  canHandle(input) {
    return isIntent(input, 'AMAZON.HelpIntent');
  },
  handle(input) {
    return input.responseBuilder
      .speak('This skill plays MDS Station radio. Say play to start, or stop to stop.')
      .reprompt('Say play to start the radio.')
      .getResponse();
  },
};

// A live stream has no next/previous/loop/shuffle
const UnsupportedAudioHandler = {
  canHandle(input) {
    const type = Alexa.getRequestType(input.requestEnvelope);
    return isIntent(input,
      'AMAZON.NextIntent', 'AMAZON.PreviousIntent', 'AMAZON.LoopOnIntent', 'AMAZON.LoopOffIntent',
      'AMAZON.ShuffleOnIntent', 'AMAZON.ShuffleOffIntent', 'AMAZON.RepeatIntent', 'AMAZON.FallbackIntent') ||
      type === 'PlaybackController.NextCommandIssued' ||
      type === 'PlaybackController.PreviousCommandIssued';
  },
  handle(input) {
    if (Alexa.getRequestType(input.requestEnvelope).startsWith('PlaybackController.')) {
      return input.responseBuilder.getResponse();
    }
    return input.responseBuilder
      .speak('Sorry, this is a live radio stream, so that is not supported.')
      .withShouldEndSession(true)
      .getResponse();
  },
};

// A live stream has no length, so Alexa may decide it is about to end.
// Queue the same stream again so playback continues without a gap.
const PlaybackNearlyFinishedHandler = {
  canHandle(input) {
    return Alexa.getRequestType(input.requestEnvelope) === 'AudioPlayer.PlaybackNearlyFinished';
  },
  handle(input) {
    const currentToken = input.requestEnvelope.request.token;
    return input.responseBuilder
      .addAudioPlayerPlayDirective('ENQUEUE', STREAM.url, makeToken(), 0, currentToken, STREAM.metadata)
      .getResponse();
  },
};

// Network hiccup: restart the stream a few times before giving up
const PlaybackFailedHandler = {
  canHandle(input) {
    return Alexa.getRequestType(input.requestEnvelope) === 'AudioPlayer.PlaybackFailed';
  },
  handle(input) {
    const request = input.requestEnvelope.request;
    console.log('Playback failed:', JSON.stringify(request.error));
    const retry = retryOf(request.token) + 1;
    if (retry > MAX_RETRIES) {
      console.log('Giving up after', MAX_RETRIES, 'retries');
      return input.responseBuilder.getResponse();
    }
    return input.responseBuilder
      .addAudioPlayerPlayDirective('REPLACE_ALL', STREAM.url, makeToken(retry), 0, null, STREAM.metadata)
      .getResponse();
  },
};

// Other AudioPlayer events only need an empty response
const AudioPlayerEventHandler = {
  canHandle(input) {
    return Alexa.getRequestType(input.requestEnvelope).startsWith('AudioPlayer.');
  },
  handle(input) {
    return input.responseBuilder.getResponse();
  },
};

// Log every incoming request so CloudWatch shows why playback stopped
const LogRequestInterceptor = {
  process(input) {
    const request = input.requestEnvelope.request;
    console.log('Request:', request.type, request.token || '', request.error ? JSON.stringify(request.error) : '');
  },
};

const SessionEndedHandler = {
  canHandle(input) {
    return Alexa.getRequestType(input.requestEnvelope) === 'SessionEndedRequest';
  },
  handle(input) {
    return input.responseBuilder.getResponse();
  },
};

const ExceptionEncounteredHandler = {
  canHandle(input) {
    return Alexa.getRequestType(input.requestEnvelope) === 'System.ExceptionEncountered';
  },
  handle(input) {
    console.log('System.ExceptionEncountered:', JSON.stringify(input.requestEnvelope.request.error));
    return input.responseBuilder.getResponse();
  },
};

const ErrorHandler = {
  canHandle() {
    return true;
  },
  handle(input, error) {
    console.log('Error:', error.stack || error);
    return input.responseBuilder
      .speak('Sorry, something went wrong.')
      .withShouldEndSession(true)
      .getResponse();
  },
};

exports.handler = Alexa.SkillBuilders.custom()
  .addRequestHandlers(
    LaunchAndPlayHandler,
    PauseStopHandler,
    HelpHandler,
    UnsupportedAudioHandler,
    PlaybackNearlyFinishedHandler,
    PlaybackFailedHandler,
    AudioPlayerEventHandler,
    SessionEndedHandler,
    ExceptionEncounteredHandler,
  )
  .addRequestInterceptors(LogRequestInterceptor)
  .addErrorHandlers(ErrorHandler)
  .lambda();
