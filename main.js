/**
 * Gets the ratio width to height inside the body element
 */
function getBodyRatio() {
    return window.innerHeight/window.innerWidth;
}

/**
 * Converts <b> and <i> elements into srt formatting
 */
function insertSpecialFormatting(textArray) {
    for (i=0; i<textArray.length;i++) {
        textArray[i] = textArray[i].replaceAll("<i>","</tspan><tspan dx=\"0\" dy=\"0\" font-style=\"italic\">")
            .replaceAll("</i>","</tspan><tspan dx=\"0\" dy=\"0\">")
            .replaceAll("<b>","</tspan><tspan dx=\"0\" dy=\"0\" font-weight=\"bold\">")
            .replaceAll("</b>","</tspan><tspan dx=\"0\" dy=\"0\">");
    }
}

/**
 * Converts text with \n newline characters into tspans
 */
function putBetweenTspans(text) {
    var header = "<tspan x=\"0\" dy=\"1.0em\">";
    var footer = "</tspan>";
    var brokenUp = text.split("\n");
    insertSpecialFormatting(brokenUp);
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
    var cursorMoveEvent = null;
    body.onmousemove = function() {
        body.style.cursor = "auto";
        if (cursorMoveEvent) {
            clearTimeout(cursorMoveEvent);
            cursorMoveEvent = null;
        }
        cursorMoveEvent = setTimeout(hideCursor,1500);
    }
}

/**
 * Waits until the next subtitle
 */
function pause(data,i,dur) {
    setTimeout(function(){showSubtitle(data,i+1,0)},dur);
    clearInnerText();
}

/**
 * Shows the given subtitle
 */
function showSubtitle(data,i,offset) {
    var thisEntry = data[i];
    if (thisEntry) {
        if (thisEntry.pause) {
            setTimeout(function(){pause(data,i,thisEntry.pause)},thisEntry.duration-offset);
        } else {
            setTimeout(function(){showSubtitle(data,i+1,0)},thisEntry.duration-offset);
        }
        setInnerTextBase(thisEntry.text);
    } else {
        console.log("Finished at index "+i.toString());
    }
}

/**
 * 5 second countdown to subtitle start
 */
function countDown(n,data,startPause,startIndex) {
    setInnerTextBase(n.toString());
    if (n < 1) {
        hideCursor();
        if (startPause <= 0) {
            showSubtitle(data,startIndex,startPause);
        }
        else if (startPause <= 1000) {
            setTimeout(function(){showSubtitle(data,startIndex,0)},startPause);
        } else {
            setTimeout(function(){pause(data,startIndex-1,startPause-1000)},1000);
        }
    } else {
        setTimeout(function(){countDown(n-1,data,startPause,startIndex);},1000);
    }
}

/**
 * Called when a file is selected
 */
function processFileData(lines,startTime,countdown) {
    var data = [];
    var currEntry = 0;
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
    //Calculate starting index
    var startIndex = 0;
    var startPause = data[0].start;
    if (startTime > 0) {
        while(data[startIndex].end < startTime) {
            startIndex++;
        }
        startPause = data[startIndex].start - startTime;
    }
    setInnerTextBase("Subtitles processed!");
    countDown(countdown,data,startPause,startIndex);
}

function onFormSubmit(form) {
    var formData = new FormData(form);
    var file = formData.get("file");
    var start = formData.get("start");
    var countdown = formData.get("countdown");
    if (file) {
        var timeRegex = new RegExp("(\\\d\\\d):(\\\d\\\d):(\\\d\\\d)");
        var timeMatch = start.match(timeRegex);
        var startTime = 1000*(Number(timeMatch[3]) + 60*(Number(timeMatch[2]) + 60*Number(timeMatch[1])));
        let reader = new FileReader();
        reader.readAsText(file);
        reader.onload = function() {
            var lines = reader.result.split("\n");
            form.parentNode.style.backgroundColor = "#000000";
            form.parentNode.removeChild(form);
            processFileData(lines,startTime,countdown);
        };
        reader.onerror = function() {
            setInnerTextBase("Unable to load file!");
        };
    }
    return false;
}