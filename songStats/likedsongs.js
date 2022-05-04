function init() {
    getParamsFromURL("likedsongs.html")
    loadRequest(properties.SPOTIFY_LIKED_SONGS_ENDPOINT, function(req, identifier) {
        if (req.status != 401) {
            var response = JSON.parse(req.responseText)
            displayPlaylistInfo("Liked Songs", response["total"])
            displayData(response["total"])
        }}, 1)
}

function loadingTemplate(message) {
    return '<i class="fa fa-spinner fa-spin fa-fw fa-2x"></i><br><div id="loadingmessage">Getting your songs.</div>'
}

function displayPlaylistInfo(playlist_name, playlist_songs) {
    $("#playlist_name").html(playlist_name)
    $("#number-of-songs").html(playlist_songs)
}

function displayData(playlist_songs) {
    var $table = $('#table')
    var data = []
    var j = 50

    $table.bootstrapTable('showLoading')

    function getData(url, increment) {
        $("#loadingmessage")[0].innerHTML = "API call: getting " + j + " of " + playlist_songs + " songs"
        if (url != null) {
            loadRequest(url, function(res, identifier) {
                response = JSON.parse(res.responseText)
                id_list = []
                response.items.forEach(element => id_list.push(element.track.artists[0].id))
                loadRequest(properties.SPOTIFY_ARTISTS_ENDPOINT + jQuery.param({ "ids": id_list.join() }), function(feat_res) {
                    features = JSON.parse(feat_res.responseText)
                    for (i in response["items"]) {
                        response["items"][i]["track"]["genres"] = { ...features["artists"][i]["genres"] }
                        data.push(response["items"][i])
                        }
                    j = j + increment
                    properties.ENV == 'dev' ? getData(null, increment) : getData(response["next"], increment)
                }, 1)
            }, 1)
        } else {
            formatted_data = doFeatureEngineering(data)
            $table.bootstrapTable('load', formatted_data)
            $table.bootstrapTable('hideLoading')

            //Plot data
            plot(formatted_data)
                
        }
    }
    getData(properties.SPOTIFY_LIKED_SONGS_ENDPOINT_INCREMENTAL, j)
}

function doFeatureEngineering(data) {

    for (song of data) {
        var date_options = {
            timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
            hour12: true,
            year: 'numeric',
            month: 'short',
            day: 'numeric'
        }

        song["added_at_non_conversion"] = song["added_at"]
        song["added_year_at"] = convertDate(song["added_at"]).toLocaleString('en-US', {year: 'numeric'})
        song["added_time_at"] = convertDate(song["added_at"]).toLocaleString('en-US', {hour: '2-digit', minute:'2-digit'})
        song["added_h24_at"] = convertDate(song["added_at"]).toLocaleString('en-US', {hour12: false, hour: '2-digit'})
        song["am_pm_at"] = timeShit(song["added_h24_at"])
        song["added_at"] = convertDate(song["added_at"]).toLocaleString('en-US', date_options)
        song["duration_ms_non_conversion"] = song["track"]["duration_ms"]
        song["duration_range"] = durationRange(song["track"]["duration_ms"])
        song["duration_ms"] = convertMS(song["track"]["duration_ms"])
        song["duration_min"] = convertMsToMin(song["track"]["duration_ms"])
        song["genre_list"] = Object.values(song["track"]["genres"]).join(", ")
        song["explicit"] = song["track"]["explicit"] ? "Yes" : "No"
        song["track_name"] = song["track"]["name"]
        song["artist_name"] = song["track"]["artists"][0]["name"]
        song["album_name"] = song["track"]["album"]["name"]
        song["popularity"] = song["track"]["popularity"]
        song["relase_date"] = song["track"]["album"]["release_date"].substring(0,4)
        song["total_tracks"] = song["track"]["album"]["total_tracks"]
        song["genre"] = song["genre_list"].replace(/\s/g, '').length < 3 ? 'undefined' : getShortGenre(song["genre_list"].split(", "))
        song["song_age"] = new Date().getFullYear() - song["relase_date"]
        song["song_age_range"] = songAgeRange(song["song_age"])
        
        delete song.track // remove track object
    }

    return data;
}

function plot(data) {

        //Plot: Liked songs added by year
            plotGroupbyLine(
                { Year: data.map(x => x.added_year_at) },
                "Liked songs added by year",
                "Added year",
                "Count",
                ["Year_count"],
                ["Year"],
                ["Year"],
                { column: "Year" },
                "plot_div"
            )

        //Plot: Genre distribution
            plotGroupbyTable(
                { Genre: data.map(x => x.genre) },
                "Genre distribution",
                ["Genre"],
                ["Genre"],
                "Genre_count",
                false,
                "plot_div2"
            )

        //Plot: Liked songs added by time of day
            plotGroupbyPie(
                { AM_PM: data.map(x => x.am_pm_at) },
                "Liked songs added at Day/Night",
                ["AM_PM"],
                ["AM_PM"],
                "AM_PM",
                "AM_PM_count",
                "plot_div3"
            )

        //Plot: Liked songs added by time of day
            plotHist(
                { Hour: data.map(x => x.added_h24_at) },
                "Liked songs added by hour",
                "Added hour",
                "Freq",
                "Hour",
                "plot_div4"
            )

        //Plot: Liked songs by explicit content
        plotGroupbyPie(
            { Explicit: data.map(x => x.explicit) },
            "Liked songs by explicit content",
            ["Explicit"],
            ["Explicit"],
            "Explicit",
            "Explicit_count",
            "plot_div5"
        )
        //Plot: Liked songs added by release year
        plotHist(
            { Year: data.map(x => x.relase_date) },
            "Liked songs by album - release year",
            "Release year",
            "Freq",
            "Year",
            "plot_div6"
        )

        //Plot: Relationship between song age and popularity
        plotScatter(
            { Age: data.map(x => x.song_age),
              Popularity: data.map(x => x.popularity)
            },
            "Relationship between song age and popularity",
            "Song Age - form release year until now",
            "Popularity",
            "Age",
            "Popularity",
            "plot_div7"
        )

        //Plot: Liked songs by song age from released year
        plotGroupbyPie(
            { Age: data.map(x => x.song_age_range) },
            "Liked songs by song age",
            ["Age"],
            ["Age"],
            "Age",
            "Age_count",
            "plot_div8"
        )

        //Plot: Artist liked songs distribution
        plotGroupbyTable(
            { Artist: data.map(x => x.artist_name) },
            "Artist liked songs distribution",
            ["Artist"],
            ["Artist"],
            "Artist_count",
            false,
            "plot_div9"
        )

        //Plot: Relationship between song age, popularity and durantion(ms)
        plotScatterNCols(
            { Duration: data.map(x => x.duration_min),
              Popularity: data.map(x => x.popularity/10)
              
            },
            "Relationship between song age, popularity and durantion(ms)",
            "plot_div10"
        )


}
