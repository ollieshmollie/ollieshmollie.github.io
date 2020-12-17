---
layout: page
title: Writing a Verilog Test Bench
---

Let's write a test bench for an ALU. This ALU will have two 64 bit inputs, A and B, a 64 bit output W, a 1 bit output Zero (asserted when the output is zero), and a 4 bit control signal Ctrl with the following truth table:

| Operation | Ctrl | W |
| --- | --- | --- |
| AND | 0000 | A & B |
| OR | 0001 | A \| B |
| ADD | 0010 | A + B |
| LSL | 0011 | A << B |
| LSR | 0100 | A >> B |
| SUB | 0110 | A - B |
| PassB | 0111 | B |

The verilog for the ALU is shown below.

```verilog
// alu.v
`timescale 1ns / 1ns

`define AND 4'b0000
`define OR 4'b0001
`define ADD 4'b0010
`define LSL 4'b0011
`define LSR 4'b0100
`define SUB 4'b0110
`define PassB 4'b0111

module alu(W, Zero, A, B, Ctrl);

   parameter n = 64;

   output [n-1:0] W;
   output          Zero;
   input [n-1:0]   A, B;
   input [3:0]     Ctrl;

   reg [n-1:0]     W;

   always @(Ctrl or A or B)
     case(Ctrl)
       `AND: W <= A & B;
       `OR: W <= A | B;
       `ADD: W <= A + B;
       `LSL: W <= A << B;
       `LSR: W <= A >> B;
       `SUB: W <= A - B;
       `PassB: W <= B;
     endcase

   assign Zero = W == 0;

endmodule
```

To test this, we need to write another verilog file that will simulate the circuit with all possible inputs. Let's call it 'alu_tb.v', and start by defining the timescale, a max string length, and the test module.

```verilog
// alu_tb.v
`timescale 1ns / 1ps
`define STRLEN 256

module alu_tb;
```

We could pretty easily just hardcode all the inputs and expected outputs, but that would be a drag. Let's use a task instead, which is kind of like a function.

```verilog
   task test;
      input [64:0] actual, expected;
      input [`STRLEN-1:0] name;
      inout [7:0]         passCount;

      if(actual == expected) begin
        $display("%s passed", name);
        passCount += 1;
      end else $display("%s failed: output: %x\texpected: %x", name, actual, expected);
   endtask
```

Note that we've included an `inout` port to count the number of tests passCount. We'll use this in another task that reports on whether all tests have passCount.

```verilog
   task allTestsPassed;
      input [7:0] passCount;
      input [7:0] numTests;

      if(passCount == numTests)
        $display ("All tests passed");
      else
        $display("Some tests failed");
   endtask
```

Next we need to instantiate the test module's test signals and the unit under test, in this case the ALU. Note that since we'll be running the tests in an `initial` block, the inputs need to be `reg`s.

```verilog
   reg [63:0]     A;
   reg [63:0]     B;
   reg [3:0]      Ctrl;
   reg [7:0]      passCount;

   wire [63:0]    W;
   wire           Zero;

   // Instantiate the  Unit Under Test (UUT)
   alu uut(
	   .W(W),
	   .Zero(Zero),
	   .A(A),
	   .B(B),
	   .Ctrl(Ctrl)
	   );
```

Now for the meat of the test bench. In an `initial` block, we need to initialize the test signals, then test some arbitrary operations to make sure they come out right. Finally we `$finish` the simulation and close the module block.

```verilog
   initial begin
      // Initialize test signals
      A = 0;
      B = 0;
      Ctrl = 0;
      passCount = 0;

      // Test ADD
      Ctrl = 4'h2;
      {A, B} = {64'hcd, 64'hab00}; #20; test({Zero, W}, 65'h0abcd, "ADD 0xcd, 0xab", passCount);

      // Test AND
      Ctrl = 4'h0;
      {A, B} = {64'h20, 64'h20}; #20; test({Zero, W}, 65'h20, "AND 0x20,0x20", passCount);

      // ...

      allTestsPassed(passCount, 2);
      $finish;
   end

endmodule
```

We have to pause between setting the inputs and testing in order to avoid checking the input just as it's being set. Also I haven't found a good way to avoid hand counting the total number of tests for `allTestsPassed`. I'll update this note when I find a solution.