var sweetAdder = function(dawg, fish) {
	var a = [];
	while(dawg < fish){
		dawg = dawg + 1;
		a.push(dawg);		
	}
	return a;
};

var goober = sweetAdder(0, 15);
