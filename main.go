package main

import (
	"flag"
)

func main() {

	startServer := flag.Bool("serve", false, "start the printqueue service")

	flag.Parse()

	if *startServer {
		serve()
		return
	}

	flag.Usage()
}
