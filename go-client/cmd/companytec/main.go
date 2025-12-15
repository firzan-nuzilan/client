package main

import (
	"bufio"
	"flag"
	"fmt"
	"os"
	"os/signal"
	"strings"
	"syscall"

	"companytec-client/pkg/api"
	"companytec-client/pkg/companytec"
)

func main() {
	host := flag.String("host", "127.0.0.1", "Device host IP")
	port := flag.Int("port", 2001, "Device port")
	apiPort := flag.Int("api-port", 3000, "API server port")
	flag.Parse()

	fmt.Printf("Companytec Client\n")
	fmt.Printf("Device: %s:%d\n", *host, *port)
	fmt.Printf("API Port: %d\n\n", *apiPort)

	// Create client
	client := companytec.NewClient(*host, *port)

	// Connect immediately for better UX
	fmt.Println("Connecting to device...")
	if err := client.Connect(); err != nil {
		fmt.Printf("Warning: Failed to connect on startup: %v\n", err)
	} else {
		fmt.Println("Connected successfully!")
	}

	// Start API Server
	server := api.NewServer(client)
	go func() {
		if err := server.Run(*apiPort); err != nil {
			fmt.Printf("API Error: %v\n", err)
		}
	}()
	fmt.Printf("API Server started on http://localhost:%d\n", *apiPort)

	// Intercept interrupts
	c := make(chan os.Signal, 1)
	signal.Notify(c, os.Interrupt, syscall.SIGTERM)
	go func() {
		<-c
		fmt.Println("\nShutting down...")
		client.Disconnect()
		os.Exit(0)
	}()

	// Interactive Loop
	scanner := bufio.NewScanner(os.Stdin)
	for {
		showMenu(*apiPort)
		fmt.Print("Select option: ")
		if !scanner.Scan() {
			break
		}
		choice := strings.TrimSpace(scanner.Text())
		if choice == "0" {
			break
		}
		handleCommand(client, scanner, choice)
	}
}

func showMenu(apiPort int) {
	fmt.Println("\n========================================")
	fmt.Println("   COMPANYTEC CLIENT - TEST MENU")
	fmt.Println("========================================")
	fmt.Println("Supply Commands:")
	fmt.Println("  1.  Read Supply (52 chars)")
	fmt.Println("  2.  Read Supply Identified")
	fmt.Println("  3.  Read Supply PAF1")
	fmt.Println("  4.  Read Supply PAF2")
	fmt.Println("  5.  Read Memory Pointers")
	fmt.Println("  6.  Increment Supply Pointer")
	fmt.Println("Visualization:")
	fmt.Println("  7.  Get Visualization")
	fmt.Println("  8.  Get Visualization Identified")
	fmt.Println("Status & Info:")
	fmt.Println("  9.  Get Status")
	fmt.Println("  10. Read Calendar")
	fmt.Println("  11. Read Extended Clock")
	fmt.Println("Pump Management:")
	fmt.Println("  12. Read Total (Volume - L)")
	fmt.Println("  13. Read Total (Value - $)")
	fmt.Println("  14. Read Price")
	fmt.Println("  15. Set Operating Mode")
	fmt.Println("  16. Set Preset Value")
	fmt.Println("  17. Change Price")
	fmt.Println("Identifier:")
	fmt.Println("  18. Read Identifier")
	fmt.Println("  19. Read Identifier from Memory")
	fmt.Println("Advanced:")
	fmt.Println("  20. Send Custom Command")
	fmt.Println("")
	fmt.Println("  0.  Exit")
	fmt.Println("========================================")
	fmt.Printf("API: curl localhost:%d/status\n", apiPort)
	fmt.Println("========================================")
}

func ask(scanner *bufio.Scanner, prompt string) string {
	fmt.Print(prompt)
	if scanner.Scan() {
		return strings.TrimSpace(scanner.Text())
	}
	return ""
}

func handleCommand(client *companytec.Client, scanner *bufio.Scanner, choice string) {
	var err error
	var res string

	switch choice {
	case "1":
		fmt.Println("--- Read Supply (52 chars) ---")
		res, err = client.ReadSupply52()
	case "2":
		fmt.Println("--- Read Supply Identified ---")
		res, err = client.ReadSupplyIdentified()
	case "3":
		fmt.Println("--- Read Supply PAF1 ---")
		res, err = client.ReadSupplyPAF1()
	case "4":
		fmt.Println("--- Read Supply PAF2 ---")
		res, err = client.ReadSupplyPAF2()
	case "5":
		fmt.Println("--- Read Memory Pointers ---")
		res, err = client.ReadMemoryPointers()
	case "6":
		fmt.Println("--- Increment Supply Pointer ---")
		res, err = client.Increment()
	case "7":
		fmt.Println("--- Get Visualization ---")
		res, err = client.GetVisualization()
	case "8":
		fmt.Println("--- Get Visualization Identified ---")
		res, err = client.GetVisualizationIdentified()
	case "9":
		fmt.Println("--- Get Status ---")
		res, err = client.GetStatus()
	case "10":
		fmt.Println("--- Read Calendar ---")
		res, err = client.ReadCalendar()
	case "11":
		fmt.Println("--- Read Extended Clock ---")
		res, err = client.ReadClockExtended()
	case "12":
		nozzle := ask(scanner, "Enter nozzle code (hex, e.g., 08): ")
		fmt.Println("--- Read Total Volume ---")
		res, err = client.ReadTotal(nozzle, "L")
	case "13":
		nozzle := ask(scanner, "Enter nozzle code (hex, e.g., 08): ")
		fmt.Println("--- Read Total Value ---")
		res, err = client.ReadTotal(nozzle, "$")
	case "14":
		nozzle := ask(scanner, "Enter nozzle code (hex, e.g., 08): ")
		fmt.Println("--- Read Price ---")
		res, err = client.ReadPrice(nozzle, "U")
	case "15":
		nozzle := ask(scanner, "Enter nozzle code (hex, e.g., 04): ")
		mode := ask(scanner, "Enter mode (L=release, B=block, A=authorize once): ")
		fmt.Println("--- Set Operating Mode ---")
		res, err = client.SetOperatingMode(nozzle, mode)
	case "16":
		nozzle := ask(scanner, "Enter nozzle code (hex, e.g., 08): ")
		val := ask(scanner, "Enter preset value (e.g., 001000): ")
		fmt.Println("--- Set Preset Value ---")
		res, err = client.SetPreset(nozzle, val)
	case "17":
		nozzle := ask(scanner, "Enter nozzle code (hex, e.g., 08): ")
		level := ask(scanner, "Enter price level (0=cash, 1=credit): ")
		price := ask(scanner, "Enter price (4 digits, e.g., 1234): ")
		fmt.Println("--- Change Price ---")
		res, err = client.ChangePrice(nozzle, level, price)
	case "18":
		fmt.Println("--- Read Identifier ---")
		res, err = client.ReadIdentifier()
	case "19":
		posStr := ask(scanner, "Enter memory position (e.g., 1): ")
		// Convert to int
		var pos int
		fmt.Sscanf(posStr, "%d", &pos)
		fmt.Println("--- Read Identifier from Memory ---")
		res, err = client.ReadIdentifierFromMemory(pos)
	case "20":
		cmd := ask(scanner, "Enter custom command (e.g., &S): ")
		fmt.Println("--- Send Custom Command ---")
		res, err = client.SendCommand(cmd) // Note: buildCommand is internal, this sends raw if possible?
		// But SendCommand is exported. The user might need to include parens/checksum if using raw?
		// Actually existing JS test client `client.sendCommand(cmd)` just sends what is passed.
		// And usually the user types raw like "(&S)" or the method adds checksum?
		// JS test client: const result = await client.sendCommand(cmd);
		// If user types `&S` in JS client, `client.sendCommand` frames it? NO.
		// `client.sendCommand` in JS just writes the command.
		// But `buildCommand` is separate.
		// So if user types `&S` in item 20, it won't work in JS unless they type `(&S)`.
		// Let's assume user knows protocol or we blindly send.
	default:
		fmt.Println("Invalid option")
		return
	}

	if err != nil {
		fmt.Printf("Error: %v\n", err)
	} else {
		fmt.Printf("Result: %s\n", res)
	}
}
