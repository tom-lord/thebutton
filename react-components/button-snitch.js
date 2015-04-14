var ButtonSnitch = React.createClass({
    generateFakeClicks: function (quantity) {
        var clicks = [];
        var colorCounts = {
            "flair-press-1": 0,
            "flair-press-2": 0,
            "flair-press-3": 0,
            "flair-press-4": 0,
            "flair-press-5": 0,
            "flair-press-6": 0
        };
        var remaining = quantity;
        var lastClickTime = moment().valueOf();
        var duration;
        var clickCount;
        var flairClass;
        while (remaining > 0) {
            duration = 60 -
                (Math.round(Math.pow(Math.random(), 10) * 60e3) / 1000);
            lastClickTime = lastClickTime - (duration * 1000);
            clickCount = Math.round(Math.pow(Math.random(), 10) * 10);
            flairClass = this.flairClass(Math.round(duration));
            clicks.unshift({
                seconds: Math.round(duration),
                time: lastClickTime,
                color: flairClass,
                clicks: clickCount,
            });
            colorCounts[flairClass] = colorCounts[flairClass] + clickCount;
            remaining = remaining - 1;
        }
        return {clicks: clicks, colorCounts: colorCounts};
    },
    getInitialStateFake: function () {
        var clickData = this.generateFakeClicks(10e3);
        return {
            chartSelected: "time",
            connected: true,
            started: moment(clickData.clicks[0].time),
            clicksTracked: clickData.clicks.length,
            lag: Math.round(Math.random() * 2000),
            participants: 0,
            secondsRemaining: 60.0,
            ticks: clickData.clicks.length * 5,
            clicks: clickData.clicks,
            colorCounts: clickData.colorCounts,
            windowWidth: 0,
            alertTime: null,
            deniedNotificationPermission: false,
            notifiedForCurrentClick: false,
            lastTimeTrackedForCurrentClick: 60
        };
    },
    getInitialStateReal: function () {
        return {
            chartSelected: "time",
            connected: false,
            started: null,
            clicksTracked: 0,
            lag: 0,
            participants: 0,
            secondsRemaining: 60.0,
            ticks: 0,
            clicks: [],
            colorCounts: {
                "flair-press-1": 0,
                "flair-press-2": 0,
                "flair-press-3": 0,
                "flair-press-4": 0,
                "flair-press-5": 0,
                "flair-press-6": 0
            },
            windowWidth: 0,
            alertTime: null,
            deniedNotificationPermission: false,
            notifiedForCurrentClick: false,
            lastTimeTrackedForCurrentClick: 60
        };
    },
    getInitialState: function () {
        return this.getInitialStateReal();
    },
    tick: function () {
        if (!this.state.connected) {
            return;
        }
        this.setState({secondsRemaining: this.state.secondsRemaining - 0.1});
    },
    addTime: function (seconds, clicks) {
        var colorCounts = this.state.colorCounts;
        colorCounts[this.flairClass(seconds)] =
            colorCounts[this.flairClass(seconds)] + clicks;
        this.setState({
            clicksTracked: this.state.clicksTracked + clicks,
            clicks: this.state.clicks.concat({
                seconds: seconds,
                time: moment().valueOf(),
                color: this.flairClass(seconds),
                clicks: clicks
            }),
            colorCounts: colorCounts,
            notifiedForCurrentClick: false
        });
    },
    flairClass: function (seconds) {
        if (seconds > 51) {
            return "flair-press-6";
        }
        if (seconds > 41) {
            return "flair-press-5";
        }
        if (seconds > 31) {
            return "flair-press-4";
        }
        if (seconds > 21) {
            return "flair-press-3";
        }
        if (seconds > 11) {
            return "flair-press-2";
        }
        return "flair-press-1";
    },
    updateChartSelection: function (chart) {
        this.setState({chartSelected: chart});
    },
    updateAlertTime: function (time) {
        var self = this;

        if (!time && time !== 0) {
            time = null;
        } else {
            time = parseInt(time, 10);
        }
        this.setState({alertTime: time});
        if (!window.Notification) {
            return;
        }
        if (Notification.permission === "denied") {
            self.setState({deniedNotificationPermission: true});
        } else if (Notification.permission === "granted") {
            self.setState({deniedNotificationPermission: false});
        } else {
            Notification.requestPermission(function (permission) {
                if (permission === "denied") {
                    self.setState({deniedNotificationPermission: true});
                } else if (permission === "granted") {
                    self.setState({deniedNotificationPermission: false});
                    new Notification(
                        "Alerts for The Button Snitch enabled!");
                }
            })
        }
    },
    sendNecessaryNotifications: function (seconds) {
        if (!this.state.alertTime && this.state.alertTime !== 0) {
            return;
        }
        if (this.state.notifiedForCurrentClick) {
            return;
        }
        if (!window.Notification) {
            return;
        }
        if (seconds <= this.state.alertTime) {
            if (Notification.permission === "denied") {
                this.setState({deniedNotificationPermission: true});
            }
            new Notification("/r/thebutton passed " + this.state.alertTime +
                " seconds at " + moment().format("LTS"));
            this.setState({notifiedForCurrentClick: true});
        }
    },
    windowResized: function () {
        this.setState({windowWidth: React.findDOMNode(this).offsetWidth});
    },
    findWebSocketFromReddit: function () {
        var self = this;
        var xhr = new XMLHttpRequest();
        xhr.addEventListener("readystatechange", function () {
            if (xhr.readyState === 4) {
                if (xhr.status === 200) {
                    var regex = /"(wss:\/\/[^"]+)/g;
                    var matches = regex.exec(this.responseText);
                    if (matches && matches[1]) {
                        self.setupWebSocket(matches[1]);
                    } else {
                        self.findWebSocketLocally();
                    }
                } else {
                    self.findWebSocketLocally();
                }
            }
        }, false);
        xhr.addEventListener("error", function () {
            self.findWebSocketLocally();
        }, false);
        // use a proxy to get /r/thebutton because CORS would
        // block us otherwise
        xhr.open("get", "//cors-unblocker.herokuapp.com/get?url=" +
            "https%3A%2F%2Fwww.reddit.com%2Fr%2Fthebutton", true);
        xhr.send();
    },
    findWebSocketLocally: function () {
        var self = this;
        var xhr = new XMLHttpRequest();
        xhr.addEventListener("readystatechange", function () {
            if (xhr.readyState === 4) {
                if (xhr.status === 200) {
                    self.setupWebSocket(this.responseText.trim());
                } else {
                    window.setTimeout(self.findWebSocketFromReddit, 5e3);
                }
            }
        }, false);
        xhr.addEventListener("error", function () {
            window.setTimeout(self.findWebSocketFromReddit, 5e3);
        }, false);
        xhr.open("get", "websocket-url.txt", true);
        xhr.send();
    },
    setupWebSocket: function (websocketUrl) {
        var currentParticipants;
        var previousSecondsLeft;
        var previousParticipants;
        var self = this;

        var socket = new WebSocket(websocketUrl);
        socket.onopen = function () {
            if (!self.state.started) {
                self.setState({started: moment()});
            }
            self.setState({connected: true});
        };
        socket.onclose = function () {
            self.setState({connected: false});
            window.setTimeout(self.findWebSocketFromReddit, 5e3);
        };
        socket.onmessage = function (event) {
            /* jshint camelcase: false, maxstatements: 20 */
            // disabling camelcase since reddit uses underscore style here
            // also bumping maxstatements until i have a chance to refactor
            /*
            sample tick data:
            {
                "type": "ticking",
                "payload": {
                    "participants_text": "608,802",
                    "tick_mac": "50e7a9fd2e4c8feae6851884f91d65908cceb06b",
                    "seconds_left": 60.0,
                    "now_str": "2015-04-06-04-08-07"
                }
            }
            */
            var packet = JSON.parse(event.data);
            if (packet.type !== "ticking") {
                return;
            }
            var tick = packet.payload;

            self.sendNecessaryNotifications(tick.seconds_left);

            currentParticipants = parseInt(
                tick.participants_text.replace(/,/g, ""),
                10
            );

            if (previousParticipants &&
                previousParticipants < currentParticipants) {
                // the second argument calculates how many people
                // clicked this time. multiple clicks apparently all count for
                // the same number.
                self.addTime(
                    previousSecondsLeft,
                    (currentParticipants - previousParticipants)
                );
            }

            self.setState({
                ticks: self.state.ticks + 1,
                lag: Math.abs(
                    moment(tick.now_str + " 0000", "YYYY-MM-DD-HH-mm-ss Z") -
                    moment()),
                participants: currentParticipants,
                secondsRemaining: tick.seconds_left
            });

            previousSecondsLeft = tick.seconds_left;
            previousParticipants = currentParticipants;
        };
    },
    promptToExit: function (event) {
        if (this.state.clicksTracked > 10) {
            var confirmation = "You've tracked more than ten clicks. " +
                "Are you sure you want to leave?";
            (event || window.event).returnValue = confirmation;
            return confirmation;
        }
    },
    componentDidMount: function () {
        this.interval = setInterval(this.tick, 100);

        // thanks to React's autobinding, no need to worry about 'this' in the
        // handler call
        window.addEventListener("resize", this.windowResized);
        this.windowResized();

        window.addEventListener("beforeunload", this.promptToExit);

        if (window.Notification && Notification.permission === "denied") {
            this.setState({deniedNotificationPermission: true});
        }

        this.findWebSocketFromReddit();
    },
    componentWillUnmount: function () {
        clearInterval(this.interval);
        window.removeEventListener("resize", this.windowResized);
    },
    render: function () {
        return (
            <div>
                <header id="nav">
                    <div className="right-nav">
                        <a href="//github.com/treyp/thebutton/">GitHub</a>
                        <span className="author">
                            <a href="//www.reddit.com/user/treyjp">
                                by /u/treyjp
                            </a>
                        </span>
                    </div>
                    <div className="right-nav">
                        <a href="//www.reddit.com/r/thebutton/">/r/thebutton</a>
                    </div>
                    <TimerDisplay
                        secondsRemaining={this.state.secondsRemaining}
                        connected={this.state.connected} />
                    <StatsDisplay
                        started={this.state.started}
                        clicksTracked={this.state.clicksTracked}
                        lag={this.state.lag}
                        participants={this.state.participants}
                        connected={this.state.connected}
                        count={this.state.ticks} />
                    <ChartSelector
                        updateChartSelection={this.updateChartSelection}
                        chartSelected={this.state.chartSelected}
                        alertTime={this.state.alertTime} />
                </header>
                <RainbowDistribution
                    connected={this.state.connected}
                    clicksTracked={this.state.clicksTracked}
                    colorCounts={this.state.colorCounts} />
                {
                    this.state.chartSelected === "log" ?
                        <LogChart
                            clicks={this.state.clicks}
                            flairClass={this.flairClass}
                            width={this.state.windowWidth}
                            secondsRemaining={this.state.secondsRemaining}
                            connected={this.state.connected}
                            />
                        :
                        (this.state.chartSelected === "time" ?
                            <TimeChart
                                started={this.state.started}
                                clicks={this.state.clicks}
                                flairClass={this.flairClass}
                                secondsRemaining={this.state.secondsRemaining}
                                connected={this.state.connected}
                                /> :
                            <AlertSettings
                                deniedNotificationPermission={
                                    this.state.deniedNotificationPermission}
                                alertTime={this.state.alertTime}
                                updateAlertTime={this.updateAlertTime} />)
                }
            </div>
        );
    }
});

window.reactRoot =
    React.render(<ButtonSnitch />, document.getElementById("button-snitch"));