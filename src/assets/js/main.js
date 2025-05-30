const getCoinData = async (name) => {
    var req = await fetch(`https://api.coingecko.com/api/v3/search?query=${name.replace(/[^a-zA-Z]/g, '')}`)  
    var res = await req.json()
    return {symbol: res.coins[0].symbol, name: res.coins[0].name}
}

const getSymbolPrice = async (symbol, windowSize) => {
    var req = await fetch(`https://api.binance.com/api/v3/ticker?symbol=${symbol.replace(/[^a-zA-Z]/g, '')}&windowSize=${windowSize.toLowerCase()}`)
    var res = await req.json()
    return {lastPrice: res.lastPrice, priceChangePercent: parseFloat(res.priceChangePercent), priceChange: res.priceChange}
}

const getSymbolBookTicker = async (symbol) => {
    var req = await fetch(`https://api.binance.com/api/v3/ticker/bookTicker?symbol=${symbol.replace(/[^a-zA-Z]/g, '')}`)
    var res = await req.json()
    return res
}

const updateClass = (element1, current, previous) => {
    element1.removeClass("green red");

    if (current > previous) {
        element1.addClass("green");
    } else if (current < previous) {
        element1.addClass("red");
    }
}

function analyzeMarket(marketData) {
    let totalBidQty = 0;
    let totalAskQty = 0;

    for (const entry of marketData) {
        totalBidQty += entry.bidQty;
        totalAskQty += entry.askQty;
    }

    const avgBidQty = totalBidQty / marketData.length;
    const avgAskQty = totalAskQty / marketData.length;

    // Adjusted trading logic based on supply and demand (quantities)
    if (avgBidQty > avgAskQty * 1.5) {
        return 2; // Strong Buy
    } else if (avgBidQty > avgAskQty * 1.1) {
        return 1; // Weak Buy
    } else if (avgAskQty > avgBidQty * 1.5) {
        return -2; // Strong Sell
    } else if (avgAskQty > avgBidQty * 1.1) {
        return -1; // Weak Sell
    } else {
        return 0; // Neutral
    }
}

const updateDecision = (container, marketAnalysis) =>{
    var decisionChart = container.find(".trading-charts")
    decisionChart.children().removeClass("chart-animation")
    decisionChart.children().removeClass("chart-fill")
    switch(marketAnalysis){
        case -2:
            decisionChart.children()[0].classList.add("chart-fill")
            decisionChart.children()[1].classList.add("chart-fill")
            break;
        case -1:
            decisionChart.children()[1].classList.add("chart-fill")
            break;
        case 0:
            break;
        case 1:
            decisionChart.children()[2].classList.add("chart-fill")
            break;
        case 2:
            decisionChart.children()[2].classList.add("chart-fill")
            decisionChart.children()[3].classList.add("chart-fill")
            break;
    }
}

function normalizeNumber(n) {
    const str = n.toString();
    if (str.includes('e')) {
      return n.toFixed(20).replace(/\.?0+$/, '');
    }
    return str;
}

const appendWidget = async (data) => {
    const coin = data.coin
    const currency = data.currency
    const symbol = `${coin}${currency}`
    const avg = data.average
    var coinData = await getCoinData(coin)
    var template = `<div class="widget-container" data-period="1d" style="display: none;">
                        <div class="left">
                            <div class="symbol-name">
                                <span class="base-name">${coinData.name} (${coinData.symbol})</span>
                                <span class="quote-name">${currency}</span>
                            </div>
                            <div class="symbol-price">
                                <span class="last-price">0$</span>
                                <span class="change-percentage">0%</span>
                            </div>
                        </div>
                        <div class="right">
                            <div class="trading-container">
                                <span class="trading-headtext">Trading Decision</span>
                                <div class="trading-charts">
                                    <div class="trading-chart chart-red chart-animation" data-index="0"></div>
                                    <div class="trading-chart chart-red chart-animation" data-index="1"></div>
                                    <div class="trading-chart chart-green chart-animation" data-index="2"></div>
                                    <div class="trading-chart chart-green chart-animation" data-index="3"></div>
                                </div>
                            </div>
                            <ul class="time-periods">
                                <li>15M</li>
                                <li>1H</li>
                                <li>6H</li>
                                <li class="active">1D</li>
                                <li>7D</li>
                            </ul>
                        </div>
                    </div>`
    var Jtemplate = $(template)

    Jtemplate.mouseenter(function(){
        window.api.send("focus", true)
    })
    
    Jtemplate.mouseleave(function(){
        window.api.send("focus", false)
    })

    $('.app').append(Jtemplate)
    Jtemplate.show(100)
    var price = Jtemplate.find(".last-price")
    var percentage = Jtemplate.find(".change-percentage")
    fitty(".last-price", {minSize:1, maxSize:28})
    fitty(".change-percentage", {minSize:1, maxSize:13})
    fitty(".base-name", {minSize:13, maxSize:16})
    Jtemplate.find('.time-periods li').on('click', function(){
        Jtemplate.attr("data-period", this.innerText)
        $(this).toggleClass("active");
        $(this).siblings().removeClass("active");
    })


    var lastPrice = 0
    setInterval(async ()=>{
        var priceData = await getSymbolPrice(symbol, Jtemplate.attr("data-period"))
        const lastPrice = parseFloat(priceData.lastPrice);
        const priceChange = parseFloat(priceData.priceChange).toFixed(8);
        const priceChangePercent = parseFloat(priceData.priceChangePercent);
        
        const formattedPrice = `$${lastPrice > 1.0 
            ? lastPrice.toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2})
            : lastPrice}`;
            
        const changePercent = `${priceChangePercent.toFixed(2)}%`;
        const formattedPriceChange = Math.abs(priceChange).toLocaleString('en-US', {minimumFractionDigits: 1, maximumFractionDigits: 1});
        
        const changeValue = `${priceChange >= 0 ? '+' : '-'}$${lastPrice >= 1.0 ? formattedPriceChange : normalizeNumber(Math.abs(priceChange))}`;

        price.text(formattedPrice);
        percentage.text(`${changeValue} (${changePercent})`);

        updateClass(price, priceData.lastPrice, lastPrice);
        updateClass(percentage, priceData.priceChangePercent, 0);

        lastPrice = priceData.lastPrice
    }, 800)

    var marketData = []
    setInterval(async ()=>{
        try {
            const data = await getSymbolBookTicker(symbol);

            const processedData = {
                bidPrice: parseFloat(data.bidPrice),
                bidQty: parseFloat(data.bidQty),
                askPrice: parseFloat(data.askPrice),
                askQty: parseFloat(data.askQty)
            };

            if (marketData.length >= avg) {
                marketData.shift();
            }
            marketData.push(processedData);

            if (marketData.length === avg) {
                const decision = analyzeMarket(marketData);
                updateDecision(Jtemplate, decision)
            }
        } catch (error) {
            console.error("Error fetching data:", error);
        }
    }, 1000)
}

