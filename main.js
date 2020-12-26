/**
 * Gets the ratio width to height inside the body element
 */
function getBodyRatio() {
    return window.innerHeight/window.innerWidth;
}

/**
 * Converts text with \n newline characters into tspans
 */
function putBetweenTspans(text) {
    var header = "<tspan x=\"0\" dy=\"1.0em\">"
    var footer = "</tspan>"
    var brokenUp = text.split("\n")
    return header + brokenUp.join(footer+header) + footer;
}

/**
 * Work out whether a certain word setup exceeds the screen ratio
 */
function doesItExceedTheRatio(lineLength,noLines,ratio) {
    return (1.6*(noLines+1))/lineLength > ratio;
}

/**
 * Adjusts the svg's viewbox to fill the text
 */
function wrapText() {
    var svgElem = document.getElementById("svg");
    var bbox = svgElem.firstElementChild.getBBox();
    var vals = [bbox.x.toString(),bbox.y.toString(),bbox.width.toString(),bbox.height.toString()];
    var ratio = getBodyRatio();
    if (ratio*1.6*bbox.width < bbox.height) vals[2] = bbox.height / (1.6*ratio);
    svgElem.setAttribute("viewBox",vals.join(" "));
}

/**
 * Puts the given text into the tspan
 */
function setInnerTextBase(text) {
    var svgElem = document.getElementById("svg");
    svgElem.firstElementChild.innerHTML = putBetweenTspans(text);
    wrapText();
}

/**
 * Clears the text
 */
function clearInnerText() {
    var svgElem = document.getElementById("svg");
    svgElem.firstElementChild.innerHTML = "";
}

/**
 * Hides the cursor when not moving
 */
function hideCursor() {
    var body = document.getElementById("body");
    body.style.cursor = "none";
    body.onmousemove = function() {
        body.style.cursor = "auto";
        setTimeout(hideCursor,1500);
    }
}

/**
 * Waits until the next subtitle
 */
function pause(data,i,dur) {
    clearInnerText();
    setTimeout(function(){showSubtitle(data,i+1)},dur);
}

/**
 * Shows the given subtitle
 */
function showSubtitle(data,i) {
    var thisEntry = data[i];
    if (thisEntry) {
        setInnerTextBase(thisEntry.text);
        if (thisEntry.pause) {
            setTimeout(function(){pause(data,i,thisEntry.pause)},thisEntry.duration);
        } else {
            setTimeout(function(){showSubtitle(data,i+1)},thisEntry.duration);
        }
    }
}

/**
 * 5 second countdown to subtitle start
 */
function countDown(n,data) {
    setInnerTextBase(n.toString());
    if (n == 0) {
        hideCursor();
        if (data[0].start <= 1000) {
            setTimeout(function(){showSubtitle(data,0)},data[0].start);
        } else {
            setTimeout(function(){pause(data,-1,data[0].start-1000)},1000);
        }
    } else {
        setTimeout(function(){countDown(n-1,data);},1000);
    }
}

/**
 * Called when a file is selected
 */
function onFileSelected(input) {
    input.parentNode.style.backgroundColor = "#000000";
    let file = input.files[0];
    let reader = new FileReader();
    reader.readAsText(file);
    reader.onload = function() {
        var data = [];
        var lines = reader.result.split("\n");
        var currEntry = 0;
        input.parentNode.removeChild(input);
	setInnerTextBase("Processing subtitles...");
        var entryPosition = 0;
        for (i=0; i<lines.length; i++) {
            entryPosition += 1;
            if (lines[i] == "") {
                entryPosition = 0;
            }
            switch(entryPosition) {
                case 0: //Empty space
                    break;
                case 1: //The index
                    currEntry = Number(lines[i]);
                    data.push({
                        start: null,
                        end: null,
                        text: null,
                        duration: null,
                        pause: null
                    });
                    break;
                case 2: //The times
                    var regex = new RegExp("(\\\d\\\d):(\\\d\\\d):(\\\d\\\d),(\\\d\\\d\\\d) --> (\\\d\\\d):(\\\d\\\d):(\\\d\\\d),(\\\d\\\d\\\d)");
                    var found = lines[i].match(regex);
                    var startHours = Number(found[1]);
                    var startMins = Number(found[2]) + 60*startHours;
                    var startSecs = Number(found[3]) + 60*startMins;
                    data[currEntry-1].start = Number(found[4]) + 1000*startSecs;
                    var endHours = Number(found[5]);
                    var endMins = Number(found[6]) + 60*endHours;
                    var endSecs = Number(found[7]) + 60*endMins;
                    data[currEntry-1].end = Number(found[8]) + 1000*endSecs;
                    data[currEntry-1].duration = data[currEntry-1].end - data[currEntry-1].start;
                    if (currEntry > 1) {
                        var pause = data[currEntry - 1].start - data[currEntry - 2].end;
                        if (pause > 0) data[currEntry - 2].pause = pause;
                    }
                    break;
                case 3: //First line of text
                    data[currEntry-1].text = lines[i];
                    break;
                default: //Subsequent lines of text
                    data[currEntry-1].text += "\n"+lines[i];
                    break;
            }
        }
        setInnerTextBase("Subtitles processed!");
        countDown(5,data);
    };
    reader.onerror = function() {
        setInnerTextBase("Unable to load file!");
    };
}
