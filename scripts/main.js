/*jslint browser: true*/
/*jslint nomen: true*/
/*global $, _, d3*/

(function () {
    'use strict';

    var app,
        views,
        populateSchoolView,

        DATA_ROOT = 'data/',

        MAX = 1500000,

        commasFormatter = d3.format(',.0f'),
        schoolCodeFormatter = d3.format('04d');


var objectSlice=function(object,fields) {
  return fields.map(function(k){
    return object[k]
  })
};

var enrollBySID = d3.map();



    $(function () {

        queue()
            .defer(d3.csv,DATA_ROOT+"FY15_Budget.csv")
            .defer(d3.csv,DATA_ROOT+"FY15_Student.csv",
                function(r) { enrollBySID.set(r.CODE,+((r.ENROLL_TOTALPROJ).replace(/[,]+/g,""))); }
            )
            .await(app.initialize);

    });

    app = {
        initialize: function (error,data,edata) {
            $('#main').fadeIn();

            $('p.what a').click(function () {
                var id = $.attr(this, 'href');
                $('html, body').animate({
                    scrollTop: $(id).offset().top
                }, 500);
                return false;
            });

            //app.data = _.filter(data, d.CODE);
            app.data = data.filter(function(row) {
                return row["CODE"] != 1 && row["BUDGETCATEGORY"] != "Total";
            })

            app.data = d3.nest()
                .key(function(x) { return objectSlice(x,["CODE","SCHOOL","SCHOOLTYPE","WARD"]) })
                .entries(app.data)

            app.data.forEach(function(d) {
                var x0     = 0;
                var x0GE   = 0;
                var x0PP   = 0;
                var x0GEPP = 0;
                var tmp = d.key.split(",")
                d.sid   = tmp[0];
                d.sname = tmp[1];
                d.stype = tmp[2];
                d.sward = tmp[3];
                // Aggregate dollars for all categories
                d.bcats = d3.range(9).map(function(i) {
                    var t_enroll   = enrollBySID.get(d.sid)
                    var t_amount   = +((d.values[i].AMOUNT).replace(/[$,]+/g,""))
                    var t_amountGE = ( ([1,2].indexOf(i) > -1) ? 0 : t_amount )
                    return {
                        name:    d.values[i].BUDGETCATEGORY,
                        amt:     t_amount,
                        amtGE:   t_amountGE,
                        x0:      x0,
                        x0GE:    x0GE,
                        x0PP:    x0/t_enroll,
                        x0GEPP:  x0GE/t_enroll,
                        amtPP:   t_amount/t_enroll,
                        amtGEPP: t_amountGE/t_enroll,
                        x1:      x0 += t_amount,
                        x1GE:    x0GE += t_amountGE,
                        x1PP:    x0PP += (t_amount/t_enroll),
                        x1GEPP:  x0GEPP += (t_amountGE/t_enroll)
                    };
                });
                d.total     = d.bcats[d.bcats.length - 1].x1;
                d.totalPP   = d.bcats[d.bcats.length - 1].x1PP;
                d.totalGEPP = d.bcats[d.bcats.length - 1].x1GEPP;
            });

            app.filterData({});

            app.loadView('Bars');

            $(window).resize(function () { app.view.resize(); });

            $('#filters').change(function () {
                var filter = {};
                $('#filters input:checked').each(function () {
                    var $el = $(this),
                        value = $el.attr('value');

                    if (value) { filter[$el.attr('name')] = value; }
                });

                app.filterData(filter);
            });
        },

        filterData: function (filter) {

            var data = _(app.data).forEach(function (school) {
                school.filtered = false;
            });

            if (!_.isEmpty(filter)) {
                data.reject(filter).forEach(function (school) {
                    school.filtered = true;
                });
            }

            if (app.view) { app.view.refresh(); }
        },

        loadView: function (view) {
            clearTimeout(window.quickUglyGlobalTimeout);
            $('#exhibit').empty();
            app.view = new views[view](app.data);
        }
    };

    window.app = app;

    views = {};

    views.Bars = function (data) {
        var header,
            that = this;

        this.$el = $('#exhibit');

        this.$el.css('overflow', 'visible');

        this.data = data;

        this.margin = {top: 20, right: 20, bottom: 20, left: 200},
            this.width = 1000 - this.margin.left - this.margin.right,
            this.height = 2000 - this.margin.top - this.margin.bottom;

        this.x = d3.scale.linear()
            .rangeRound([0, this.width]);

        this.color = d3.scale.ordinal()
            .range(["#98abc5", "#8a89a6", "#7b6888", "#6b486b", "#a05d56", "#d0743c", "#ff8c00", "#ff0000", "#00ff00"]);

        this.xAxis = d3.svg.axis()
            .scale(this.x)
            .orient("bottom")
            .tickFormat(d3.format(".2s"));

        var legendForm = d3.select("#exhibit").append("form");

        var sortCat = 0
        //  data.sort(function(a,b) { return a.total - b.total });
        //  data.sort(function(a, b) { return (a.bcats[sortCat].x1-a.bcats[sortCat].x0) - (b.bcats[sortCat].x1-b.bcats[sortCat].x0); });
        //  data.sort(function(a, b) { return (a.bcats[sortCat].amtPP) - (b.bcats[sortCat].amtPP); });
        data.sort(function(a, b) { return (a.bcats[sortCat].amtGEPP) - (b.bcats[sortCat].amtGEPP); });
        //  data.sort(function(a, b) { return (a.totalGEPP) - (b.totalGEPP); });


        this.x.domain([0, d3.max(data, function(d) { return d.totalGEPP; })]);

        this.svg = d3.select("#exhibit").append("svg")
            .attr("width", this.width + this.margin.left + this.margin.right)
            .attr("height", this.height + this.margin.top + this.margin.bottom)
            .append("g")
            .attr("transform", "translate(" + this.margin.left + "," + this.margin.top + ")");

        this.svg.append("g")
            .attr("class", "x axis")
            .attr("transform", "translate(0," + this.height + ")")
            .call(this.xAxis)
            .append("text")
                .attr("x", this.width-6)
                .attr("dy", "2.5em")
                .style("text-anchor", "end")
                .text("Dollars");
    

        this.refresh();
    };

    views.Bars.prototype.resize = function () {
        return;
    };

    views.Bars.prototype.refresh = function () {


        var y = d3.scale.ordinal()
            .rangeRoundBands([this.height, 0], .2);

        var yAxis = d3.svg.axis()
            .scale(y)
            .orient("left");

        y.domain(this.data.map(function(d) { return d.sname; }));
        //x.domain([0, d3.max(data, function(d) { return d.total; })]);
        //x.domain([0, d3.max(data, function(d) { return d.totalPP; })]);

        this.svg.append("g")
            .attr("class", "y axis")
            .call(yAxis);

        var state = this.svg.selectAll(".school")
            .data(this.data)
            .enter()
            .append("g")
                .attr("class", "g")
                .attr("transform", function(d) { return "translate(0," + y(d.sname) + ")"; });
        
        var that = this;
        state.selectAll("rect")
            .data(function(d) {return d.bcats})
            .enter()
            .append("rect")
                .attr("height", y.rangeBand())
                //.attr("x", function(d) {return x(d.x0);})
                //.attr("x", function(d) {return x(d.x0PP);})
                .attr("x", function(d) {return that.x(d.x0GEPP);})
                //.attr("width", function(d) {return x(d.x1)-x(d.x0);})
                //.attr("width", function(d) {return x(d.amtPP);})
                .attr("width", function(d) {return that.x(d.amtGEPP);})
                .style("fill", function(d) {return that.color(d.name);});


    };

}());


